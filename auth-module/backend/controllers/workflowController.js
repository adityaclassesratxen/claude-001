const pool = require('../config/database');

// Get all workflows
const getWorkflows = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticket_type, is_active } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (ticket_type) {
      whereConditions.push(`ticket_type = $${paramIndex}`);
      queryParams.push(ticket_type);
      paramIndex++;
    }

    if (is_active !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      queryParams.push(is_active === 'true');
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT 
        w.*,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM workflow_transitions WHERE workflow_id = w.id) as transition_count
      FROM workflows w
      LEFT JOIN users u ON w.created_by = u.id
      ${whereClause}
      ORDER BY w.ticket_type, w.is_default DESC, w.name
    `;

    const result = await client.query(query, queryParams);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflows'
    });
  } finally {
    client.release();
  }
};

// Get workflow by ID with transitions
const getWorkflowById = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    const workflowQuery = `
      SELECT w.*, u.name as created_by_name
      FROM workflows w
      LEFT JOIN users u ON w.created_by = u.id
      WHERE w.id = $1
    `;

    const workflowResult = await client.query(workflowQuery, [id]);

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found'
      });
    }

    const workflow = workflowResult.rows[0];

    // Get transitions
    const transitionsQuery = `
      SELECT * FROM workflow_transitions
      WHERE workflow_id = $1
      ORDER BY from_status, to_status
    `;

    const transitions = await client.query(transitionsQuery, [id]);

    res.status(200).json({
      success: true,
      data: {
        ...workflow,
        transitions: transitions.rows
      }
    });

  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow'
    });
  } finally {
    client.release();
  }
};

// Get valid transitions for a ticket
const getValidTransitions = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId } = req.params;

    const query = `SELECT * FROM get_valid_transitions($1, $2)`;
    const result = await client.query(query, [ticketId, req.user.id]);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get valid transitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch valid transitions'
    });
  } finally {
    client.release();
  }
};

// Perform transition
const performTransition = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { ticketId } = req.params;
    const { transition_id, comment, metadata = {} } = req.body;

    // Validation
    if (!transition_id) {
      return res.status(400).json({
        success: false,
        message: 'Transition ID is required'
      });
    }

    // Get ticket details
    const ticketQuery = `
      SELECT t.*, w.id as workflow_id
      FROM tickets t
      LEFT JOIN workflows w ON w.ticket_type = t.type AND w.is_active = TRUE
      WHERE t.id = $1 AND t.is_deleted = FALSE
    `;

    const ticketResult = await client.query(ticketQuery, [ticketId]);

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const ticket = ticketResult.rows[0];

    // Get transition details
    const transitionQuery = `
      SELECT * FROM workflow_transitions
      WHERE id = $1 AND workflow_id = $2 AND from_status = $3
    `;

    const transitionResult = await client.query(transitionQuery, [
      transition_id,
      ticket.workflow_id,
      ticket.status
    ]);

    if (transitionResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transition for current ticket status'
      });
    }

    const transition = transitionResult.rows[0];

    // Check role requirement
    if (transition.required_role && req.user.role !== transition.required_role && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: `This transition requires ${transition.required_role} role`
      });
    }

    // Check required fields
    if (transition.required_fields && transition.required_fields.length > 0) {
      for (const field of transition.required_fields) {
        if (!ticket[field]) {
          return res.status(400).json({
            success: false,
            message: `Required field missing: ${field}`
          });
        }
      }
    }

    // Check if approval is required
    if (transition.requires_approval) {
      // Create approval request
      const approvalQuery = `
        INSERT INTO ticket_approvals (
          ticket_id,
          transition_id,
          requested_by,
          required_approvers,
          status
        ) VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id
      `;

      // Get approvers (you can customize this logic)
      const approversQuery = `
        SELECT id FROM users 
        WHERE role = $1 AND is_deleted = FALSE
        LIMIT 3
      `;
      const approvers = await client.query(approversQuery, [transition.approval_role || 'admin']);
      const approverIds = approvers.rows.map(a => a.id);

      const approvalResult = await client.query(approvalQuery, [
        ticketId,
        transition_id,
        req.user.id,
        approverIds
      ]);

      // Update ticket status to awaiting_approval
      await client.query(
        `UPDATE tickets SET status = 'awaiting_approval', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [ticketId]
      );

      // Log transition
      await client.query(
        `INSERT INTO ticket_transitions (ticket_id, transition_id, from_status, to_status, performed_by, comment, metadata)
         VALUES ($1, $2, $3, 'awaiting_approval', $4, $5, $6)`,
        [ticketId, transition_id, ticket.status, req.user.id, comment || 'Submitted for approval', JSON.stringify(metadata)]
      );

      // Log activity
      await client.query(
        `SELECT log_activity($1, 'transition.approval_requested', 'ticket', $2, $3)`,
        [req.user.id, ticketId, `Requested approval for transition: ${transition.name}`]
      );

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Approval requested successfully',
        data: {
          approval_id: approvalResult.rows[0].id,
          status: 'awaiting_approval'
        }
      });
    }

    // Perform transition (no approval required)
    // Update ticket status
    await client.query(
      `UPDATE tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [transition.to_status, ticketId]
    );

    // Execute transition actions
    if (transition.actions && Array.isArray(transition.actions)) {
      for (const action of transition.actions) {
        await executeTransitionAction(client, ticketId, action, req.user.id);
      }
    }

    // Log transition
    await client.query(
      `INSERT INTO ticket_transitions (ticket_id, transition_id, from_status, to_status, performed_by, comment, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ticketId, transition_id, ticket.status, transition.to_status, req.user.id, comment, JSON.stringify(metadata)]
    );

    // Add comment if provided
    if (comment) {
      await client.query(
        `INSERT INTO ticket_comments (ticket_id, user_id, comment_text)
         VALUES ($1, $2, $3)`,
        [ticketId, req.user.id, comment]
      );
    }

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'transition.performed', 'ticket', $2, $3)`,
      [req.user.id, ticketId, `Transitioned to ${transition.to_status}: ${transition.name}`]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Transition performed successfully',
      data: {
        new_status: transition.to_status
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Perform transition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform transition'
    });
  } finally {
    client.release();
  }
};

// Helper function to execute transition actions
async function executeTransitionAction(client, ticketId, action, userId) {
  switch (action.action) {
    case 'set_field':
      if (action.field && action.value) {
        const value = action.value === 'now' ? 'CURRENT_TIMESTAMP' : `'${action.value}'`;
        await client.query(
          `UPDATE tickets SET ${action.field} = ${value} WHERE id = $1`,
          [ticketId]
        );
      }
      break;

    case 'add_comment':
      if (action.text) {
        await client.query(
          `INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal)
           VALUES ($1, $2, $3, true)`,
          [ticketId, userId, action.text]
        );
      }
      break;

    case 'assign':
      if (action.user_id) {
        await client.query(
          `UPDATE tickets SET assignee_id = $1 WHERE id = $2`,
          [action.user_id, ticketId]
        );
      }
      break;

    case 'notify':
      // TODO: Implement notification system
      console.log(`Notify action: ${action.target} for ticket ${ticketId}`);
      break;

    default:
      console.log(`Unknown action: ${action.action}`);
  }
}

// Get transition history for a ticket
const getTransitionHistory = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId } = req.params;

    const query = `
      SELECT 
        tt.*,
        u.name as performed_by_name,
        u.avatar_url as performed_by_avatar,
        wt.name as transition_name,
        wt.button_text
      FROM ticket_transitions tt
      LEFT JOIN users u ON tt.performed_by = u.id
      LEFT JOIN workflow_transitions wt ON tt.transition_id = wt.id
      WHERE tt.ticket_id = $1
      ORDER BY tt.performed_at DESC
    `;

    const result = await client.query(query, [ticketId]);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get transition history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transition history'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getWorkflows,
  getWorkflowById,
  getValidTransitions,
  performTransition,
  getTransitionHistory
};
