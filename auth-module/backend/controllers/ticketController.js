const pool = require('../config/database');

// Get all tickets with advanced filtering (from previous response)
const getTickets = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      type = '',
      status = '',
      priority = '',
      assignee_id = '',
      reporter_id = '',
      project_id = '',
      sprint_id = '',
      epic_id = '',
      labels = '',
      sla_breached = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereConditions = ['t.is_deleted = FALSE'];
    let queryParams = [];
    let paramIndex = 1;

    // Search filter
    if (search) {
      whereConditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex} OR t.ticket_key ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (type) {
      whereConditions.push(`t.type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`t.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (priority) {
      whereConditions.push(`t.priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    if (assignee_id) {
      if (assignee_id === 'unassigned') {
        whereConditions.push('t.assignee_id IS NULL');
      } else {
        whereConditions.push(`t.assignee_id = $${paramIndex}`);
        queryParams.push(assignee_id);
        paramIndex++;
      }
    }

    if (reporter_id) {
      whereConditions.push(`t.reporter_id = $${paramIndex}`);
      queryParams.push(reporter_id);
      paramIndex++;
    }

    if (project_id) {
      whereConditions.push(`t.project_id = $${paramIndex}`);
      queryParams.push(project_id);
      paramIndex++;
    }

    if (sprint_id) {
      if (sprint_id === 'backlog') {
        whereConditions.push('t.sprint_id IS NULL');
      } else {
        whereConditions.push(`t.sprint_id = $${paramIndex}`);
        queryParams.push(sprint_id);
        paramIndex++;
      }
    }

    if (epic_id) {
      whereConditions.push(`t.epic_id = $${paramIndex}`);
      queryParams.push(epic_id);
      paramIndex++;
    }

    if (labels) {
      whereConditions.push(`t.labels && $${paramIndex}::text[]`);
      queryParams.push(`{${labels}}`);
      paramIndex++;
    }

    if (sla_breached) {
      whereConditions.push(`t.sla_breached = $${paramIndex}`);
      queryParams.push(sla_breached === 'true');
      paramIndex++;
    }

    // Tenant filter
    if (req.user && req.user.role !== 'super_admin' && req.user.tenant_id) {
      whereConditions.push(`t.tenant_id = $${paramIndex}`);
      queryParams.push(req.user.tenant_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Validate sort
    const allowedSortColumns = [
      'ticket_key', 'title', 'type', 'status', 'priority', 
      'created_at', 'updated_at', 'sla_due_time'
    ];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count
    const countQuery = `SELECT COUNT(*) as total FROM tickets t ${whereClause}`;
    const countResult = await client.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get tickets
    const ticketsQuery = `
      SELECT 
        t.id,
        t.ticket_key,
        t.title,
        t.description,
        t.type,
        t.status,
        t.priority,
        t.severity,
        t.impact,
        t.urgency,
        t.story_points,
        t.labels,
        t.sla_due_time,
        t.sla_breached,
        t.created_at,
        t.updated_at,
        p.name as project_name,
        p.project_key,
        reporter.name as reporter_name,
        reporter.avatar_url as reporter_avatar,
        assignee.name as assignee_name,
        assignee.avatar_url as assignee_avatar,
        (SELECT COUNT(*) FROM ticket_comments WHERE ticket_id = t.id) as comment_count,
        (SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = t.id) as attachment_count,
        (SELECT COUNT(*) FROM ticket_watchers WHERE ticket_id = t.id) as watcher_count
      FROM tickets t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users reporter ON t.reporter_id = reporter.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      ${whereClause}
      ORDER BY t.${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const ticketsResult = await client.query(ticketsQuery, queryParams);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: ticketsResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets'
    });
  } finally {
    client.release();
  }
};

// Get single ticket (from previous response)
const getTicketById = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        t.*,
        p.name as project_name,
        p.project_key,
        reporter.id as reporter_id,
        reporter.name as reporter_name,
        reporter.email as reporter_email,
        reporter.avatar_url as reporter_avatar,
        assignee.id as assignee_id,
        assignee.name as assignee_name,
        assignee.email as assignee_email,
        assignee.avatar_url as assignee_avatar,
        parent.ticket_key as parent_ticket_key,
        parent.title as parent_ticket_title,
        epic.ticket_key as epic_key,
        epic.title as epic_title,
        sprint.name as sprint_name,
        resolved_user.name as resolved_by_name
      FROM tickets t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users reporter ON t.reporter_id = reporter.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      LEFT JOIN tickets parent ON t.parent_ticket_id = parent.id
      LEFT JOIN tickets epic ON t.epic_id = epic.id
      LEFT JOIN sprints sprint ON t.sprint_id = sprint.id
      LEFT JOIN users resolved_user ON t.resolved_by = resolved_user.id
      WHERE t.id = $1 AND t.is_deleted = FALSE
    `;

    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Get comments
    const commentsQuery = `
      SELECT 
        c.*,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url
      FROM ticket_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = $1
      ORDER BY c.created_at DESC
    `;
    const comments = await client.query(commentsQuery, [id]);

    // Get attachments
    const attachmentsQuery = `
      SELECT 
        a.*,
        u.name as uploaded_by_name
      FROM ticket_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.ticket_id = $1
      ORDER BY a.uploaded_at DESC
    `;
    const attachments = await client.query(attachmentsQuery, [id]);

    // Get watchers
    const watchersQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.avatar_url
      FROM ticket_watchers w
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.ticket_id = $1
    `;
    const watchers = await client.query(watchersQuery, [id]);

    // Get links
    const linksQuery = `
      SELECT 
        l.*,
        t.ticket_key,
        t.title,
        t.type,
        t.status
      FROM ticket_links l
      LEFT JOIN tickets t ON l.target_ticket_id = t.id
      WHERE l.source_ticket_id = $1
    `;
    const links = await client.query(linksQuery, [id]);

    // Get history
    const historyQuery = `
      SELECT 
        h.*,
        u.name as user_name
      FROM ticket_history h
      LEFT JOIN users u ON h.user_id = u.id
      WHERE h.ticket_id = $1
      ORDER BY h.changed_at DESC
      LIMIT 50
    `;
    const history = await client.query(historyQuery, [id]);

    const ticket = {
      ...result.rows[0],
      comments: comments.rows,
      attachments: attachments.rows,
      watchers: watchers.rows,
      links: links.rows,
      history: history.rows
    };

    res.status(200).json({
      success: true,
      data: ticket
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket'
    });
  } finally {
    client.release();
  }
};

// Create new ticket
const createTicket = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      title,
      description,
      type,
      priority = 'medium',
      severity,
      impact,
      urgency,
      project_id,
      assignee_id,
      parent_ticket_id,
      epic_id,
      sprint_id,
      story_points,
      labels,
      affected_service,
      configuration_item,
      business_service,
      category,
      subcategory,
      environment,
      custom_fields
    } = req.body;

    // Validation
    if (!title || !type) {
      return res.status(400).json({
        success: false,
        message: 'Title and type are required'
      });
    }

    // Validate type
    const validTypes = ['epic', 'story', 'task', 'bug', 'incident', 'service_request', 'problem', 'change'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket type'
      });
    }

    // Generate ticket key
    const keyResult = await client.query(
      'SELECT generate_ticket_key($1, $2) as ticket_key',
      [project_id || null, type]
    );
    const ticket_key = keyResult.rows[0].ticket_key;

    // Determine initial status based on type
    let initial_status = 'open';
    if (['epic', 'story', 'task', 'bug'].includes(type)) {
      initial_status = 'backlog';  // Jira types start in backlog
    } else {
      initial_status = 'new';  // ServiceNow types start as new
    }

    // Calculate SLA due time
    const slaResult = await client.query(
      'SELECT calculate_sla_due_time($1, $2, $3) as sla_due_time',
      [type, priority, req.user?.tenant_id || null]
    );
    const sla_due_time = slaResult.rows[0].sla_due_time;

    // Insert ticket
    const insertQuery = `
      INSERT INTO tickets (
        ticket_key,
        title,
        description,
        type,
        status,
        priority,
        severity,
        impact,
        urgency,
        project_id,
        reporter_id,
        assignee_id,
        parent_ticket_id,
        epic_id,
        sprint_id,
        story_points,
        labels,
        affected_service,
        configuration_item,
        business_service,
        category,
        subcategory,
        environment,
        custom_fields,
        tenant_id,
        sla_start_time,
        sla_due_time,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP, $26, $27
      )
      RETURNING *
    `;

    const values = [
      ticket_key,
      title,
      description || null,
      type,
      initial_status,
      priority,
      severity || null,
      impact || null,
      urgency || null,
      project_id || null,
      req.user.id,
      assignee_id || null,
      parent_ticket_id || null,
      epic_id || null,
      sprint_id || null,
      story_points || null,
      labels || null,
      affected_service || null,
      configuration_item || null,
      business_service || null,
      category || null,
      subcategory || null,
      environment || null,
      custom_fields ? JSON.stringify(custom_fields) : '{}',
      req.user.tenant_id || null,
      sla_due_time,
      req.user.id
    ];

    const result = await client.query(insertQuery, values);
    const newTicket = result.rows[0];

    // Add reporter as watcher
    await client.query(
      'INSERT INTO ticket_watchers (ticket_id, user_id) VALUES ($1, $2)',
      [newTicket.id, req.user.id]
    );

    // Add assignee as watcher if different from reporter
    if (assignee_id && assignee_id !== req.user.id) {
      await client.query(
        'INSERT INTO ticket_watchers (ticket_id, user_id) VALUES ($1, $2)',
        [newTicket.id, assignee_id]
      );
    }

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'ticket.created', 'ticket', $2, $3)`,
      [req.user.id, newTicket.id, `Created ${type} ticket: ${ticket_key}`]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: newTicket
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket'
    });
  } finally {
    client.release();
  }
};

// Update ticket
const updateTicket = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      title,
      description,
      status,
      priority,
      severity,
      impact,
      urgency,
      assignee_id,
      epic_id,
      sprint_id,
      story_points,
      labels,
      affected_service,
      configuration_item,
      business_service,
      category,
      subcategory,
      environment,
      estimated_hours,
      actual_hours,
      remaining_hours,
      resolution_notes,
      custom_fields
    } = req.body;

    // Check if ticket exists
    const ticketCheck = await client.query(
      'SELECT * FROM tickets WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const oldTicket = ticketCheck.rows[0];

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;

      // If status is resolved or closed, set resolution time
      if (['resolved', 'closed'].includes(status) && !oldTicket.resolved_at) {
        updates.push(`resolved_at = CURRENT_TIMESTAMP`);
        updates.push(`resolved_by = $${paramIndex}`);
        values.push(req.user.id);
        paramIndex++;
        updates.push(`sla_resolution_time = CURRENT_TIMESTAMP`);
      }
    }

    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex}`);
      values.push(priority);
      paramIndex++;

      // Recalculate SLA if priority changed
      if (priority !== oldTicket.priority) {
        const slaResult = await client.query(
          'SELECT calculate_sla_due_time($1, $2, $3) as sla_due_time',
          [oldTicket.type, priority, oldTicket.tenant_id]
        );
        const new_sla_due_time = slaResult.rows[0].sla_due_time;
        updates.push(`sla_due_time = $${paramIndex}`);
        values.push(new_sla_due_time);
        paramIndex++;
      }
    }

    if (severity !== undefined) {
      updates.push(`severity = $${paramIndex}`);
      values.push(severity);
      paramIndex++;
    }

    if (impact !== undefined) {
      updates.push(`impact = $${paramIndex}`);
      values.push(impact);
      paramIndex++;
    }

    if (urgency !== undefined) {
      updates.push(`urgency = $${paramIndex}`);
      values.push(urgency);
      paramIndex++;
    }

    if (assignee_id !== undefined) {
      updates.push(`assignee_id = $${paramIndex}`);
      values.push(assignee_id);
      paramIndex++;

      // Add new assignee as watcher
      if (assignee_id) {
        await client.query(
          `INSERT INTO ticket_watchers (ticket_id, user_id) 
           VALUES ($1, $2) 
           ON CONFLICT (ticket_id, user_id) DO NOTHING`,
          [id, assignee_id]
        );
      }
    }

    if (epic_id !== undefined) {
      updates.push(`epic_id = $${paramIndex}`);
      values.push(epic_id);
      paramIndex++;
    }

    if (sprint_id !== undefined) {
      updates.push(`sprint_id = $${paramIndex}`);
      values.push(sprint_id);
      paramIndex++;
    }

    if (story_points !== undefined) {
      updates.push(`story_points = $${paramIndex}`);
      values.push(story_points);
      paramIndex++;
    }

    if (labels !== undefined) {
      updates.push(`labels = $${paramIndex}`);
      values.push(labels);
      paramIndex++;
    }

    if (affected_service !== undefined) {
      updates.push(`affected_service = $${paramIndex}`);
      values.push(affected_service);
      paramIndex++;
    }

    if (configuration_item !== undefined) {
      updates.push(`configuration_item = $${paramIndex}`);
      values.push(configuration_item);
      paramIndex++;
    }

    if (business_service !== undefined) {
      updates.push(`business_service = $${paramIndex}`);
      values.push(business_service);
      paramIndex++;
    }

    if (category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    if (subcategory !== undefined) {
      updates.push(`subcategory = $${paramIndex}`);
      values.push(subcategory);
      paramIndex++;
    }

    if (environment !== undefined) {
      updates.push(`environment = $${paramIndex}`);
      values.push(environment);
      paramIndex++;
    }

    if (estimated_hours !== undefined) {
      updates.push(`estimated_hours = $${paramIndex}`);
      values.push(estimated_hours);
      paramIndex++;
    }

    if (actual_hours !== undefined) {
      updates.push(`actual_hours = $${paramIndex}`);
      values.push(actual_hours);
      paramIndex++;
    }

    if (remaining_hours !== undefined) {
      updates.push(`remaining_hours = $${paramIndex}`);
      values.push(remaining_hours);
      paramIndex++;
    }

    if (resolution_notes !== undefined) {
      updates.push(`resolution_notes = $${paramIndex}`);
      values.push(resolution_notes);
      paramIndex++;
    }

    if (custom_fields !== undefined) {
      updates.push(`custom_fields = $${paramIndex}`);
      values.push(JSON.stringify(custom_fields));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE tickets
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'ticket.updated', 'ticket', $2, $3)`,
      [req.user.id, id, `Updated ticket: ${oldTicket.ticket_key}`]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket'
    });
  } finally {
    client.release();
  }
};

// Delete ticket (soft delete)
const deleteTicket = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    // Check if ticket exists
    const ticketCheck = await client.query(
      'SELECT ticket_key FROM tickets WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if ticket has child tickets
    const childCheck = await client.query(
      'SELECT COUNT(*) as count FROM tickets WHERE parent_ticket_id = $1 AND is_deleted = FALSE',
      [id]
    );

    if (parseInt(childCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete ticket with child tickets. Delete child tickets first.'
      });
    }

    // Soft delete
    await client.query(
      `UPDATE tickets 
       SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 
       WHERE id = $2`,
      [req.user.id, id]
    );

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'ticket.deleted', 'ticket', $2, $3)`,
      [req.user.id, id, `Deleted ticket: ${ticketCheck.rows[0].ticket_key}`]
    );

    res.status(200).json({
      success: true,
      message: 'Ticket deleted successfully'
    });

  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ticket'
    });
  } finally {
    client.release();
  }
};

// Bulk update tickets
const bulkUpdateTickets = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { ticket_ids, updates } = req.body;

    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ticket_ids array is required'
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'updates object is required'
      });
    }

    // Build update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'status', 'priority', 'assignee_id', 'sprint_id', 
      'epic_id', 'labels', 'category', 'subcategory'
    ];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(ticket_ids);

    const query = `
      UPDATE tickets
      SET ${updateFields.join(', ')}
      WHERE id = ANY($${paramIndex}) AND is_deleted = FALSE
      RETURNING id, ticket_key
    `;

    const result = await client.query(query, values);

    // Log activity for each ticket
    for (const ticket of result.rows) {
      await client.query(
        `SELECT log_activity($1, 'ticket.bulk_updated', 'ticket', $2, $3)`,
        [req.user.id, ticket.id, `Bulk updated ticket: ${ticket.ticket_key}`]
      );
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `${result.rowCount} ticket(s) updated successfully`,
      data: result.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update tickets'
    });
  } finally {
    client.release();
  }
};

// Get ticket statistics
const getTicketStats = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { project_id, sprint_id, type } = req.query;

    let whereConditions = ['is_deleted = FALSE'];
    let queryParams = [];
    let paramIndex = 1;

    if (project_id) {
      whereConditions.push(`project_id = $${paramIndex}`);
      queryParams.push(project_id);
      paramIndex++;
    }

    if (sprint_id) {
      whereConditions.push(`sprint_id = $${paramIndex}`);
      queryParams.push(sprint_id);
      paramIndex++;
    }

    if (type) {
      whereConditions.push(`type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (req.user && req.user.role !== 'super_admin' && req.user.tenant_id) {
      whereConditions.push(`tenant_id = $${paramIndex}`);
      queryParams.push(req.user.tenant_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const statsQuery = `
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(*) FILTER (WHERE status IN ('open', 'new', 'backlog')) as open_tickets,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tickets,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_tickets,
        COUNT(*) FILTER (WHERE priority = 'critical') as critical_tickets,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority_tickets,
        COUNT(*) FILTER (WHERE sla_breached = TRUE) as sla_breached_tickets,
        COUNT(*) FILTER (WHERE assignee_id IS NULL) as unassigned_tickets,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as created_this_week,
        COUNT(*) FILTER (WHERE resolved_at >= CURRENT_DATE - INTERVAL '7 days') as resolved_this_week,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours,
        SUM(story_points) FILTER (WHERE type IN ('story', 'task', 'bug')) as total_story_points
      FROM tickets
      ${whereClause}
    `;

    const result = await client.query(statsQuery, queryParams);

    // Get tickets by type
    const typeQuery = `
      SELECT 
        type,
        COUNT(*) as count
      FROM tickets
      ${whereClause}
      GROUP BY type
      ORDER BY count DESC
    `;
    const typeResult = await client.query(typeQuery, queryParams);

    // Get tickets by status
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM tickets
      ${whereClause}
      GROUP BY status
      ORDER BY count DESC
    `;
    const statusResult = await client.query(statusQuery, queryParams);

    res.status(200).json({
      success: true,
      data: {
        overview: result.rows[0],
        by_type: typeResult.rows,
        by_status: statusResult.rows
      }
    });

  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket statistics'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  bulkUpdateTickets,
  getTicketStats
};
