const pool = require('../config/database');

// Get SLA definitions
const getSLADefinitions = async (req, res) => {
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
        sd.*,
        bh.name as business_hours_name
      FROM sla_definitions sd
      LEFT JOIN business_hours bh ON sd.business_hours_id = bh.id
      ${whereClause}
      ORDER BY sd.ticket_type, sd.priority, sd.metric_type
    `;

    const result = await client.query(query, queryParams);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get SLA definitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SLA definitions'
    });
  } finally {
    client.release();
  }
};

// Get SLA for a ticket
const getTicketSLA = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticketId } = req.params;

    const query = `
      SELECT 
        ts.*,
        sd.name as sla_name,
        t.ticket_key,
        t.title,
        t.type,
        t.priority,
        t.status,
        EXTRACT(EPOCH FROM (ts.due_time - CURRENT_TIMESTAMP)) / 3600 as hours_remaining,
        CASE 
          WHEN ts.status = 'paused' THEN 0
          WHEN ts.due_time > CURRENT_TIMESTAMP THEN 
            ROUND((EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ts.start_time)) / 
                   EXTRACT(EPOCH FROM (ts.due_time - ts.start_time))) * 100, 2)
          ELSE 100
        END as percent_elapsed
      FROM ticket_slas ts
      LEFT JOIN sla_definitions sd ON ts.sla_definition_id = sd.id
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      WHERE ts.ticket_id = $1
      ORDER BY ts.created_at DESC
    `;

    const result = await client.query(query, [ticketId]);

    const pauseHistoryQuery = `
      SELECT 
        sph.*,
        pauser.name as paused_by_name,
        resumer.name as resumed_by_name
      FROM sla_pause_history sph
      LEFT JOIN users pauser ON sph.paused_by = pauser.id
      LEFT JOIN users resumer ON sph.resumed_by = resumer.id
      WHERE sph.ticket_sla_id = ANY($1)
      ORDER BY sph.paused_at DESC
    `;

    const slaIds = result.rows.map(r => r.id);
    const pauseHistory = slaIds.length > 0 
      ? await client.query(pauseHistoryQuery, [slaIds])
      : { rows: [] };

    res.status(200).json({
      success: true,
      data: {
        slas: result.rows,
        pause_history: pauseHistory.rows
      }
    });

  } catch (error) {
    console.error('Get ticket SLA error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket SLA'
    });
  } finally {
    client.release();
  }
};

// Pause SLA
const pauseSLA = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { ticketId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Pause reason is required'
      });
    }

    const slaQuery = `
      SELECT ts.*, t.ticket_key
      FROM ticket_slas ts
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      WHERE ts.ticket_id = $1 
        AND ts.status IN ('in_progress', 'not_started')
      ORDER BY ts.created_at DESC
      LIMIT 1
    `;

    const slaResult = await client.query(slaQuery, [ticketId]);

    if (slaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active SLA found for this ticket'
      });
    }

    const sla = slaResult.rows[0];

    await client.query(
      `UPDATE ticket_slas 
       SET status = 'paused', 
           pause_start_time = CURRENT_TIMESTAMP,
           pause_reason = $1,
           paused_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [reason, req.user.id, sla.id]
    );

    await client.query(
      `INSERT INTO sla_pause_history (ticket_sla_id, paused_at, pause_reason, paused_by)
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3)`,
      [sla.id, reason, req.user.id]
    );

    await client.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal)
       VALUES ($1, $2, $3, true)`,
      [ticketId, req.user.id, `SLA paused: ${reason}`]
    );

    await client.query(
      `SELECT log_activity($1, 'sla.paused', 'ticket', $2, $3)`,
      [req.user.id, ticketId, `Paused SLA for ${sla.ticket_key}: ${reason}`]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'SLA paused successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Pause SLA error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause SLA'
    });
  } finally {
    client.release();
  }
};

// Resume SLA
const resumeSLA = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { ticketId } = req.params;

    const slaQuery = `
      SELECT ts.*, t.ticket_key
      FROM ticket_slas ts
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      WHERE ts.ticket_id = $1 AND ts.status = 'paused'
      ORDER BY ts.created_at DESC
      LIMIT 1
    `;

    const slaResult = await client.query(slaQuery, [ticketId]);

    if (slaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No paused SLA found for this ticket'
      });
    }

    const sla = slaResult.rows[0];

    await client.query(
      `UPDATE ticket_slas 
       SET status = 'in_progress',
           total_pause_duration = total_pause_duration + (CURRENT_TIMESTAMP - pause_start_time),
           due_time = due_time + (CURRENT_TIMESTAMP - pause_start_time),
           pause_start_time = NULL,
           pause_reason = NULL,
           paused_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sla.id]
    );

    await client.query(
      `UPDATE sla_pause_history 
       SET resumed_at = CURRENT_TIMESTAMP,
           resumed_by = $1,
           pause_duration = CURRENT_TIMESTAMP - pause_start_time
       WHERE ticket_sla_id = $2 AND resumed_at IS NULL`,
      [req.user.id, sla.id]
    );

    const newDueTime = await client.query(
      `SELECT due_time FROM ticket_slas WHERE id = $1`,
      [sla.id]
    );

    await client.query(
      `UPDATE tickets SET sla_due_time = $1 WHERE id = $2`,
      [newDueTime.rows[0].due_time, ticketId]
    );

    await client.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal)
       VALUES ($1, $2, 'SLA resumed', true)`,
      [ticketId, req.user.id]
    );

    await client.query(
      `SELECT log_activity($1, 'sla.resumed', 'ticket', $2, $3)`,
      [req.user.id, ticketId, `Resumed SLA for ${sla.ticket_key}`]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'SLA resumed successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Resume SLA error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume SLA'
    });
  } finally {
    client.release();
  }
};

// Get SLA breaches
const getSLABreaches = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      page = 1, 
      limit = 20,
      ticket_type,
      priority,
      days = 7
    } = req.query;

    const offset = (page - 1) * limit;

    let whereConditions = [
      'ts.is_breached = true',
      `ts.breach_time >= CURRENT_TIMESTAMP - INTERVAL '${days} days'`
    ];
    let queryParams = [];
    let paramIndex = 1;

    if (ticket_type) {
      whereConditions.push(`t.type = $${paramIndex}`);
      queryParams.push(ticket_type);
      paramIndex++;
    }

    if (priority) {
      whereConditions.push(`t.priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM ticket_slas ts
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      ${whereClause}
    `;
    const countResult = await client.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    queryParams.push(limit, offset);
    const breachesQuery = `
      SELECT 
        ts.*,
        t.ticket_key,
        t.title,
        t.type,
        t.priority,
        t.status,
        sd.name as sla_name,
        assignee.name as assignee_name,
        EXTRACT(EPOCH FROM ts.breach_duration) / 3600 as breach_hours
      FROM ticket_slas ts
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      LEFT JOIN sla_definitions sd ON ts.sla_definition_id = sd.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      ${whereClause}
      ORDER BY ts.breach_time DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await client.query(breachesQuery, queryParams);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get SLA breaches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SLA breaches'
    });
  } finally {
    client.release();
  }
};

// Get SLA metrics/dashboard
const getSLAMetrics = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { ticket_type, days = 30 } = req.query;

    let whereCondition = `WHERE ts.created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'`;
    const params = [];
    let paramIndex = 1;

    if (ticket_type) {
      whereCondition += ` AND t.type = $${paramIndex}`;
      params.push(ticket_type);
      paramIndex++;
    }

    const overallQuery = `
      SELECT 
        COUNT(ts.id) as total_slas,
        COUNT(ts.id) FILTER (WHERE ts.status = 'in_progress') as in_progress,
        COUNT(ts.id) FILTER (WHERE ts.status = 'paused') as paused,
        COUNT(ts.id) FILTER (WHERE ts.status = 'completed') as completed,
        COUNT(ts.id) FILTER (WHERE ts.is_breached = true) as breached,
        ROUND(AVG(EXTRACT(EPOCH FROM ts.actual_duration) / 3600), 2) as avg_resolution_hours,
        ROUND((COUNT(ts.id) FILTER (WHERE ts.is_breached = false AND ts.status = 'completed')::DECIMAL / 
               NULLIF(COUNT(ts.id) FILTER (WHERE ts.status = 'completed'), 0)) * 100, 2) as compliance_percentage,
        ROUND(AVG(EXTRACT(EPOCH FROM ts.total_pause_duration) / 3600), 2) as avg_pause_hours
      FROM ticket_slas ts
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      ${whereCondition}
    `;

    const overall = await client.query(overallQuery, params);

    const byTypeQuery = `
      SELECT 
        t.type,
        COUNT(ts.id) as total,
        COUNT(ts.id) FILTER (WHERE ts.is_breached = true) as breached,
        ROUND((COUNT(ts.id) FILTER (WHERE ts.is_breached = false AND ts.status = 'completed')::DECIMAL / 
               NULLIF(COUNT(ts.id) FILTER (WHERE ts.status = 'completed'), 0)) * 100, 2) as compliance_percentage
      FROM ticket_slas ts
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      ${whereCondition}
      GROUP BY t.type
      ORDER BY total DESC
    `;

    const byType = await client.query(byTypeQuery, params);

    const byPriorityQuery = `
      SELECT 
        t.priority,
        COUNT(ts.id) as total,
        COUNT(ts.id) FILTER (WHERE ts.is_breached = true) as breached,
        ROUND((COUNT(ts.id) FILTER (WHERE ts.is_breached = false AND ts.status = 'completed')::DECIMAL / 
               NULLIF(COUNT(ts.id) FILTER (WHERE ts.status = 'completed'), 0)) * 100, 2) as compliance_percentage
      FROM ticket_slas ts
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      ${whereCondition}
      GROUP BY t.priority
      ORDER BY 
        CASE t.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END
    `;

    const byPriority = await client.query(byPriorityQuery, params);

    const trendQuery = `
      SELECT 
        DATE(ts.created_at) as date,
        COUNT(ts.id) as total,
        COUNT(ts.id) FILTER (WHERE ts.is_breached = true) as breached,
        COUNT(ts.id) FILTER (WHERE ts.status = 'completed') as completed
      FROM ticket_slas ts
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      ${whereCondition}
      GROUP BY DATE(ts.created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    const trend = await client.query(trendQuery, params);

    res.status(200).json({
      success: true,
      data: {
        overall: overall.rows[0],
        by_type: byType.rows,
        by_priority: byPriority.rows,
        trend: trend.rows
      }
    });

  } catch (error) {
    console.error('Get SLA metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SLA metrics'
    });
  } finally {
    client.release();
  }
};

// Get tickets at risk
const getTicketsAtRisk = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { threshold_percentage = 75 } = req.query;

    const query = `
      SELECT 
        ts.*,
        t.ticket_key,
        t.title,
        t.type,
        t.priority,
        t.status,
        assignee.name as assignee_name,
        ROUND((EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ts.start_time)) / 
               EXTRACT(EPOCH FROM (ts.due_time - ts.start_time))) * 100, 2) as percent_elapsed,
        EXTRACT(EPOCH FROM (ts.due_time - CURRENT_TIMESTAMP)) / 3600 as hours_remaining
      FROM ticket_slas ts
      LEFT JOIN tickets t ON ts.ticket_id = t.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      WHERE ts.status = 'in_progress'
        AND ts.due_time > CURRENT_TIMESTAMP
        AND (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ts.start_time)) / 
             EXTRACT(EPOCH FROM (ts.due_time - ts.start_time))) * 100 >= $1
      ORDER BY ts.due_time ASC
      LIMIT 50
    `;

    const result = await client.query(query, [threshold_percentage]);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get tickets at risk error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets at risk'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getSLADefinitions,
  getTicketSLA,
  pauseSLA,
  resumeSLA,
  getSLABreaches,
  getSLAMetrics,
  getTicketsAtRisk
};
