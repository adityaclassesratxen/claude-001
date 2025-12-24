const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/tickets';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, documents, and zip files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Get all attachments for a ticket
const getTicketAttachments = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId } = req.params;

    // Check if ticket exists
    const ticketCheck = await client.query(
      'SELECT id FROM tickets WHERE id = $1 AND is_deleted = FALSE',
      [ticketId]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const query = `
      SELECT 
        a.id,
        a.file_name,
        a.file_url,
        a.file_size,
        a.file_type,
        a.uploaded_at,
        u.id as uploaded_by_id,
        u.name as uploaded_by_name,
        u.avatar_url as uploaded_by_avatar
      FROM ticket_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.ticket_id = $1
      ORDER BY a.uploaded_at DESC
    `;

    const result = await client.query(query, [ticketId]);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attachments'
    });
  } finally {
    client.release();
  }
};

// Upload attachment to ticket
const uploadTicketAttachment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { ticketId } = req.params;

    // Check if ticket exists
    const ticketCheck = await client.query(
      'SELECT ticket_key FROM tickets WHERE id = $1 AND is_deleted = FALSE',
      [ticketId]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const ticket = ticketCheck.rows[0];

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const file = req.file;

    // Insert attachment record
    const insertQuery = `
      INSERT INTO ticket_attachments (
        ticket_id,
        file_name,
        file_url,
        file_size,
        file_type,
        uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const fileUrl = `/uploads/tickets/${file.filename}`;

    const result = await client.query(insertQuery, [
      ticketId,
      file.originalname,
      fileUrl,
      file.size,
      file.mimetype,
      req.user.id
    ]);

    const newAttachment = result.rows[0];

    // Update ticket's updated_at
    await client.query(
      'UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [ticketId]
    );

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'attachment.added', 'ticket', $2, $3)`,
      [req.user.id, ticketId, `Added attachment to ${ticket.ticket_key}: ${file.originalname}`]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        ...newAttachment,
        uploaded_by_name: req.user.name
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    
    // Delete uploaded file if database insert failed
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete file:', err);
      });
    }

    console.error('Upload attachment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload attachment'
    });
  } finally {
    client.release();
  }
};

// Delete attachment
const deleteTicketAttachment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId, attachmentId } = req.params;

    // Get attachment details
    const attachmentCheck = await client.query(
      'SELECT * FROM ticket_attachments WHERE id = $1 AND ticket_id = $2',
      [attachmentId, ticketId]
    );

    if (attachmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const attachment = attachmentCheck.rows[0];

    // Only uploader or admin can delete
    if (attachment.uploaded_by !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this attachment'
      });
    }

    // Delete from database
    await client.query('DELETE FROM ticket_attachments WHERE id = $1', [attachmentId]);

    // Delete physical file
    const filePath = path.join(__dirname, '..', attachment.file_url);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete physical file:', err);
    });

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'attachment.deleted', 'ticket', $2, $3)`,
      [req.user.id, ticketId, `Deleted attachment: ${attachment.file_name}`]
    );

    res.status(200).json({
      success: true,
      message: 'Attachment deleted successfully'
    });

  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete attachment'
    });
  } finally {
    client.release();
  }
};

// Download attachment
const downloadTicketAttachment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId, attachmentId } = req.params;

    // Get attachment details
    const query = `
      SELECT * FROM ticket_attachments 
      WHERE id = $1 AND ticket_id = $2
    `;

    const result = await client.query(query, [attachmentId, ticketId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const attachment = result.rows[0];
    const filePath = path.join(__dirname, '..', attachment.file_url);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Set headers for download
    res.setHeader('Content-Type', attachment.file_type);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.file_name}"`);

    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download attachment'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getTicketAttachments,
  uploadTicketAttachment,
  deleteTicketAttachment,
  downloadTicketAttachment,
  upload // Export multer instance
};
