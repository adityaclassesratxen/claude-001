const pool = require('../config/database');

// Get all watchers for a ticket
const getTicketWatchers = async (req, res) => {
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
        w.id,
        w.created_at,
        u.id as user_id,
        u.name,
        u.email,
        u.avatar_url,
        u.role
      FROM ticket_watchers w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.ticket_id = $1
      ORDER BY w.created_at ASC
    `;

    const result = await client.query(query, [ticketId]);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get watchers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch watchers'
    });
  } finally {
    client.release();
  }
};

// Add watcher to ticket
const addTicketWatcher = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId } = req.params;
    const { user_id } = req.body;

    // Validation
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

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

    // Check if user exists
    const userCheck = await client.query(
      'SELECT id, name FROM users WHERE id = $1 AND is_deleted = FALSE',
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userCheck.rows[0];

    // Check if already watching
    const watcherCheck = await client.query(
      'SELECT id FROM ticket_watchers WHERE ticket_id = $1 AND user_id = $2',
      [ticketId, user_id]
    );

    if (watcherCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User is already watching this ticket'
      });
    }

    // Add watcher
    const insertQuery = `
      INSERT INTO ticket_watchers (ticket_id, user_id)
      VALUES ($1, $2)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [ticketId, user_id]);

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'watcher.added', 'ticket', $2, $3)`,
      [req.user.id, ticketId, `Added ${user.name} as watcher to ${ticket.ticket_key}`]
    );

    res.status(201).json({
      success: true,
      message: 'Watcher added successfully',
      data: {
        ...result.rows[0],
        user_id: user.id,
        name: user.name
      }
    });

  } catch (error) {
    console.error('Add watcher error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add watcher'
    });
  } finally {
    client.release();
  }
};

// Remove watcher from ticket
const removeTicketWatcher = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId, watcherId } = req.params;

    // Check if watcher exists
    const watcherCheck = await client.query(
      'SELECT w.*, u.name FROM ticket_watchers w LEFT JOIN users u ON w.user_id = u.id WHERE w.id = $1 AND w.ticket_id = $2',
      [watcherId, ticketId]
    );

    if (watcherCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Watcher not found'
      });
    }

    const watcher = watcherCheck.rows[0];

    // Only the watcher themselves or admin can remove
    if (watcher.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove this watcher'
      });
    }

    // Remove watcher
    await client.query('DELETE FROM ticket_watchers WHERE id = $1', [watcherId]);

    // Get ticket key for logging
    const ticketResult = await client.query('SELECT ticket_key FROM tickets WHERE id = $1', [ticketId]);
    const ticket = ticketResult.rows[0];

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'watcher.removed', 'ticket', $2, $3)`,
      [req.user.id, ticketId, `Removed ${watcher.name} as watcher from ${ticket.ticket_key}`]
    );

    res.status(200).json({
      success: true,
      message: 'Watcher removed successfully'
    });

  } catch (error) {
    console.error('Remove watcher error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove watcher'
    });
  } finally {
    client.release();
  }
};

// Toggle current user as watcher
const toggleWatcher = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;

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

    // Check if already watching
    const watcherCheck = await client.query(
      'SELECT id FROM ticket_watchers WHERE ticket_id = $1 AND user_id = $2',
      [ticketId, userId]
    );

    let isWatching = false;
    let message = '';

    if (watcherCheck.rows.length > 0) {
      // Remove watcher
      await client.query(
        'DELETE FROM ticket_watchers WHERE ticket_id = $1 AND user_id = $2',
        [ticketId, userId]
      );
      isWatching = false;
      message = 'Stopped watching ticket';

      // Log activity
      await client.query(
        `SELECT log_activity($1, 'watcher.removed', 'ticket', $2, $3)`,
        [userId, ticketId, `Stopped watching ${ticket.ticket_key}`]
      );
    } else {
      // Add watcher
      await client.query(
        'INSERT INTO ticket_watchers (ticket_id, user_id) VALUES ($1, $2)',
        [ticketId, userId]
      );
      isWatching = true;
      message = 'Now watching ticket';

      // Log activity
      await client.query(
        `SELECT log_activity($1, 'watcher.added', 'ticket', $2, $3)`,
        [userId, ticketId, `Started watching ${ticket.ticket_key}`]
      );
    }

    res.status(200).json({
      success: true,
      message,
      data: {
        is_watching: isWatching
      }
    });

  } catch (error) {
    console.error('Toggle watcher error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle watcher status'
    });
  } finally {
    client.release();
  }
};

// Check if current user is watching
const checkWatcherStatus = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;

    const query = `
      SELECT EXISTS(
        SELECT 1 FROM ticket_watchers 
        WHERE ticket_id = $1 AND user_id = $2
      ) as is_watching
    `;

    const result = await client.query(query, [ticketId, userId]);

    res.status(200).json({
      success: true,
      data: {
        is_watching: result.rows[0].is_watching
      }
    });

  } catch (error) {
    console.error('Check watcher status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check watcher status'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getTicketWatchers,
  addTicketWatcher,
  removeTicketWatcher,
  toggleWatcher,
  checkWatcherStatus
};
