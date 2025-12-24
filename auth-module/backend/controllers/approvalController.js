const pool = require('../config/database');

// Get pending approvals for current user
const getPendingApprovals = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        ta.*,
        t.ticket_key,
        t.title as ticket_title,
        t.type as ticket_type,
        t.priority,
        requester.name as requested_by_name,
        requester.avatar_url as requested_by_avatar
      FROM ticket_approvals ta
      LEFT JOIN tickets t ON ta.ticket_id = t.id
      LEFT JOIN users requester ON ta.requested_by = requester.id
      WHERE ta.status = 'pending'
        AND $1 = ANY(ta.required_approvers)
        AND NOT EXISTS (
          SELECT 1 FROM approval_responses 
          WHERE approval_id = ta.id AND user_id = $1
        )
      ORDER BY ta.requested_at DESC
    `;

    const result = await client.query(query, [userId]);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals'
    });
  } finally {
    client.release();
  }
};

// Get approval details
const getApprovalById = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    const approvalQuery = `
      SELECT 
        ta.*,
        t.ticket_key,
        t.title as ticket_title,
        t.description as ticket_description,
        t.type as ticket_type,
        requester.name as requested_by_name,
        wt.name as transition_name,
        wt.to_status as target_status
      FROM ticket_approvals ta
      LEFT JOIN tickets t ON ta.ticket_id = t.id
      LEFT JOIN users requester ON ta.requested_by = requester.id
      LEFT JOIN workflow_transitions wt ON ta.transition_id = wt.id
      WHERE ta.id = $1
    `;

    const approvalResult = await client.query(approvalQuery, [id]);

    if (approvalResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Approval not found'
      });
    }

    const approval = approvalResult.rows[0];

    // Get approval responses
    const responsesQuery = `
      SELECT 
        ar.*,
        u.name as user_name,
        u.avatar_url
      FROM approval_responses ar
      LEFT JOIN users u ON ar.user_id = u.id
      WHERE ar.approval_id = $1
      ORDER BY ar.responded_at DESC
    `;

    const responses = await client.query(responsesQuery, [id]);

    res.status(200).json({
      success: true,
      data: {
        ...approval,
        responses: responses.rows
      }
    });

  } catch (error) {
    console.error('Get approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch approval details'
    });
  } finally {
    client.release();
  }
};

// Approve or reject
const respondToApproval = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { response, response_notes } = req.body;
    const userId = req.user.id;

    // Validation
    if (!['approved', 'rejected'].includes(response)) {
      return res.status(400).json({
        success: false,
        message: 'Response must be "approved" or "rejected"'
      });
    }

    // Get approval details
    const approvalQuery = `
      SELECT ta.*, t.ticket_key, t.status as current_status, wt.to_status
      FROM ticket_approvals ta
      LEFT JOIN tickets t ON ta.ticket_id = t.id
      LEFT JOIN workflow_transitions wt ON ta.transition_id = wt.id
      WHERE ta.id = $1 AND ta.status = 'pending'
    `;

    const approvalResult = await client.query(approvalQuery, [id]);

    if (approvalResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Approval not found or already completed'
      });
    }

    const approval = approvalResult.rows[0];

    // Check if user is an approver
    if (!approval.required_approvers.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to approve this request'
      });
    }

    // Check if user already responded
    const responseCheck = await client.query(
      'SELECT id FROM approval_responses WHERE approval_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (responseCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already responded to this approval'
      });
    }

    // Record response
    await client.query(
      `INSERT INTO approval_responses (approval_id, user_id, response, response_notes)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, response, response_notes]
    );

    // Handle rejection
    if (response === 'rejected') {
      await client.query(
        `UPDATE ticket_approvals 
         SET status = 'rejected', rejected_by = $1, rejection_reason = $2, completed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [userId, response_notes, id]
      );

      // Revert ticket status
      await client.query(
        `UPDATE tickets SET status = $1 WHERE id = $2`,
        [approval.current_status, approval.ticket_id]
      );

      // Add comment
      await client.query(
        `INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal)
         VALUES ($1, $2, $3, false)`,
        [approval.ticket_id, userId, `Approval rejected: ${response_notes || 'No reason provided'}`]
      );

      // Log activity
      await client.query(
        `SELECT log_activity($1, 'approval.rejected', 'ticket', $2, $3)`,
        [userId, approval.ticket_id, `Rejected approval for ${approval.ticket_key}`]
      );
    } else {
      // Handle approval
      // Check if all approvers have approved
      const allResponsesQuery = `
        SELECT COUNT(*) as count
        FROM approval_responses
        WHERE approval_id = $1 AND response = 'approved'
      `;
      const allResponses = await client.query(allResponsesQuery, [id]);
      const approvedCount = parseInt(allResponses.rows[0].count);

      if (approvedCount >= approval.required_approvers.length) {
        // All approved - complete the transition
        await client.query(
          `UPDATE ticket_approvals 
           SET status = 'approved', completed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );

        // Update ticket status
        await client.query(
          `UPDATE tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [approval.to_status, approval.ticket_id]
        );

        // Log transition
        await client.query(
          `INSERT INTO ticket_transitions (ticket_id, transition_id, from_status, to_status, performed_by, comment)
           VALUES ($1, $2, $3, $4, $5, 'Approved by all approvers')`,
          [approval.ticket_id, approval.transition_id, approval.current_status, approval.to_status, userId]
        );

        // Add comment
        await client.query(
          `INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal)
           VALUES ($1, $2, 'All approvals received. Transition completed.', false)`,
          [approval.ticket_id, userId]
        );

        // Log activity
        await client.query(
          `SELECT log_activity($1, 'approval.completed', 'ticket', $2, $3)`,
          [userId, approval.ticket_id, `All approvals received for ${approval.ticket_key}`]
        );
      } else {
        // Partial approval
        await client.query(
          `UPDATE ticket_approvals 
           SET approved_by = array_append(approved_by, $1)
           WHERE id = $2`,
          [userId, id]
        );

        // Log activity
        await client.query(
          `SELECT log_activity($1, 'approval.approved', 'ticket', $2, $3)`,
          [userId, approval.ticket_id, `Approved transition for ${approval.ticket_key}`]
        );
      }
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Successfully ${response === 'approved' ? 'approved' : 'rejected'}`,
      data: {
        response
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Respond to approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to approval'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getPendingApprovals,
  getApprovalById,
  respondToApproval
};
