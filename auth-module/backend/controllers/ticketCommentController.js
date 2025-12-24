const pool = require('../config/database');

// Get all comments for a ticket
const getTicketComments = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId } = req.params;
    const { is_internal } = req.query;

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

    let whereClause = 'WHERE c.ticket_id = $1';
    const params = [ticketId];

    // Filter by internal/external comments
    if (is_internal !== undefined) {
      whereClause += ' AND c.is_internal = $2';
      params.push(is_internal === 'true');
    }

    const query = `
      SELECT 
        c.id,
        c.comment_text,
        c.is_internal,
        c.created_at,
        c.updated_at,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url,
        u.role as user_role
      FROM ticket_comments c
      LEFT JOIN users u ON c.user_id = u.id
      ${whereClause}
      ORDER BY c.created_at ASC
    `;

    const result = await client.query(query, params);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments'
    });
  } finally {
    client.release();
  }
};

// Add comment to ticket
const addTicketComment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { ticketId } = req.params;
    const { comment_text, is_internal = false } = req.body;

    // Validation
    if (!comment_text || comment_text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    // Check if ticket exists
    const ticketCheck = await client.query(
      'SELECT ticket_key, title FROM tickets WHERE id = $1 AND is_deleted = FALSE',
      [ticketId]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const ticket = ticketCheck.rows[0];

    // Insert comment
    const insertQuery = `
      INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      ticketId,
      req.user.id,
      comment_text.trim(),
      is_internal
    ]);

    const newComment = result.rows[0];

    // Get user details
    const userQuery = `
      SELECT id, name, email, avatar_url, role
      FROM users
      WHERE id = $1
    `;
    const userResult = await client.query(userQuery, [req.user.id]);
    const user = userResult.rows[0];

    // Update ticket's updated_at timestamp
    await client.query(
      'UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [ticketId]
    );

    // Log activity
    const activityDesc = is_internal 
      ? `Added internal note to ${ticket.ticket_key}` 
      : `Added comment to ${ticket.ticket_key}`;

    await client.query(
      `SELECT log_activity($1, 'comment.added', 'ticket', $2, $3)`,
      [req.user.id, ticketId, activityDesc]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        ...newComment,
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        avatar_url: user.avatar_url,
        user_role: user.role
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  } finally {
    client.release();
  }
};

// Update comment
const updateTicketComment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId, commentId } = req.params;
    const { comment_text } = req.body;

    // Validation
    if (!comment_text || comment_text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    // Check if comment exists and belongs to user
    const commentCheck = await client.query(
      'SELECT * FROM ticket_comments WHERE id = $1 AND ticket_id = $2',
      [commentId, ticketId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const comment = commentCheck.rows[0];

    // Only comment owner can edit (or admin/super_admin)
    if (comment.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this comment'
      });
    }

    // Update comment
    const updateQuery = `
      UPDATE ticket_comments
      SET comment_text = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await client.query(updateQuery, [comment_text.trim(), commentId]);

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'comment.updated', 'ticket', $2, 'Updated comment')`,
      [req.user.id, ticketId]
    );

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update comment'
    });
  } finally {
    client.release();
  }
};

// Delete comment
const deleteTicketComment = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId, commentId } = req.params;

    // Check if comment exists
    const commentCheck = await client.query(
      'SELECT user_id FROM ticket_comments WHERE id = $1 AND ticket_id = $2',
      [commentId, ticketId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const comment = commentCheck.rows[0];

    // Only comment owner can delete (or admin/super_admin)
    if (comment.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this comment'
      });
    }

    // Delete comment
    await client.query('DELETE FROM ticket_comments WHERE id = $1', [commentId]);

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'comment.deleted', 'ticket', $2, 'Deleted comment')`,
      [req.user.id, ticketId]
    );

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getTicketComments,
  addTicketComment,
  updateTicketComment,
  deleteTicketComment
};
