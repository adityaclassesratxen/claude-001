-- ============================================
-- WORKFLOW TRANSITION SYSTEM
-- ============================================

-- Create transition_action enum
CREATE TYPE transition_action AS ENUM (
  'assign',
  'notify',
  'set_field',
  'run_script',
  'require_approval',
  'add_comment',
  'send_email'
);

-- Update workflows table with more details
DROP TABLE IF EXISTS workflows CASCADE;
CREATE TABLE workflows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  ticket_type ticket_type NOT NULL,
  tenant_id INTEGER REFERENCES tenants(id),
  
  -- Workflow definition
  initial_state ticket_status NOT NULL,
  states JSONB NOT NULL, -- Array of valid states with metadata
  transitions JSONB NOT NULL, -- Valid transitions with conditions
  
  -- Settings
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow transitions (specific transition definitions)
CREATE TABLE workflow_transitions (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  from_status ticket_status NOT NULL,
  to_status ticket_status NOT NULL,
  
  -- Conditions
  conditions JSONB DEFAULT '{}', -- Conditions that must be met
  required_fields TEXT[], -- Fields that must be filled
  required_role VARCHAR(50), -- Role required to perform transition
  
  -- Actions to perform on transition
  actions JSONB DEFAULT '[]', -- Array of actions to execute
  
  -- Approval settings
  requires_approval BOOLEAN DEFAULT FALSE,
  approval_role VARCHAR(50),
  approval_group INTEGER,
  
  -- UI settings
  button_text VARCHAR(100),
  button_color VARCHAR(20),
  icon VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(workflow_id, from_status, to_status)
);

-- Ticket approvals (ServiceNow style)
CREATE TABLE ticket_approvals (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  transition_id INTEGER REFERENCES workflow_transitions(id),
  
  -- Approval details
  requested_by INTEGER REFERENCES users(id),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  required_approvers INTEGER[] NOT NULL, -- Array of user IDs
  
  -- Approval status
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  approved_by INTEGER[],
  rejected_by INTEGER,
  rejection_reason TEXT,
  
  completed_at TIMESTAMP,
  
  -- Metadata
  approval_notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Individual approver responses
CREATE TABLE approval_responses (
  id SERIAL PRIMARY KEY,
  approval_id INTEGER NOT NULL REFERENCES ticket_approvals(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  
  response VARCHAR(20) NOT NULL, -- approved, rejected, skipped
  response_notes TEXT,
  responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(approval_id, user_id)
);

-- Transition log (every state change)
CREATE TABLE ticket_transitions (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  transition_id INTEGER REFERENCES workflow_transitions(id),
  
  from_status ticket_status NOT NULL,
  to_status ticket_status NOT NULL,
  
  performed_by INTEGER REFERENCES users(id),
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Transition context
  comment TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes
CREATE INDEX idx_workflows_type ON workflows(ticket_type);
CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX idx_workflow_transitions_workflow ON workflow_transitions(workflow_id);
CREATE INDEX idx_workflow_transitions_from ON workflow_transitions(from_status);
CREATE INDEX idx_workflow_transitions_to ON workflow_transitions(to_status);
CREATE INDEX idx_ticket_approvals_ticket ON ticket_approvals(ticket_id);
CREATE INDEX idx_ticket_approvals_status ON ticket_approvals(status);
CREATE INDEX idx_approval_responses_approval ON approval_responses(approval_id);
CREATE INDEX idx_approval_responses_user ON approval_responses(user_id);
CREATE INDEX idx_ticket_transitions_ticket ON ticket_transitions(ticket_id);
CREATE INDEX idx_ticket_transitions_performed ON ticket_transitions(performed_at);

-- Function to get valid transitions for a ticket
CREATE OR REPLACE FUNCTION get_valid_transitions(
  p_ticket_id INTEGER,
  p_user_id INTEGER
) RETURNS TABLE (
  transition_id INTEGER,
  name VARCHAR,
  to_status ticket_status,
  button_text VARCHAR,
  button_color VARCHAR,
  icon VARCHAR,
  requires_approval BOOLEAN
) AS $$
DECLARE
  v_current_status ticket_status;
  v_ticket_type ticket_type;
  v_workflow_id INTEGER;
  v_user_role VARCHAR;
BEGIN
  -- Get ticket details
  SELECT t.status, t.type, w.id, u.role
  INTO v_current_status, v_ticket_type, v_workflow_id, v_user_role
  FROM tickets t
  LEFT JOIN workflows w ON w.ticket_type = t.type AND w.is_active = TRUE
  LEFT JOIN users u ON u.id = p_user_id
  WHERE t.id = p_ticket_id;
  
  -- Return valid transitions
  RETURN QUERY
  SELECT 
    wt.id,
    wt.name,
    wt.to_status,
    wt.button_text,
    wt.button_color,
    wt.icon,
    wt.requires_approval
  FROM workflow_transitions wt
  WHERE wt.workflow_id = v_workflow_id
    AND wt.from_status = v_current_status
    AND (wt.required_role IS NULL OR wt.required_role = v_user_role);
END;
$$ LANGUAGE plpgsql;

-- Insert default workflows
INSERT INTO workflows (name, description, ticket_type, initial_state, states, transitions, is_default) VALUES

-- Jira-style workflow for Stories/Tasks/Bugs
('Software Development Workflow', 'Standard agile development workflow', 'story', 'backlog', 
  '[
    {"status": "backlog", "name": "Backlog", "category": "todo"},
    {"status": "selected_for_development", "name": "Selected for Development", "category": "todo"},
    {"status": "in_progress", "name": "In Progress", "category": "in_progress"},
    {"status": "in_review", "name": "In Review", "category": "in_progress"},
    {"status": "in_qa", "name": "In QA", "category": "in_progress"},
    {"status": "resolved", "name": "Resolved", "category": "done"},
    {"status": "closed", "name": "Closed", "category": "done"}
  ]'::jsonb,
  '{
    "backlog": ["selected_for_development"],
    "selected_for_development": ["in_progress", "backlog"],
    "in_progress": ["in_review", "backlog"],
    "in_review": ["in_qa", "in_progress"],
    "in_qa": ["resolved", "in_progress"],
    "resolved": ["closed", "in_progress"],
    "closed": ["in_progress"]
  }'::jsonb,
  true
),

-- ServiceNow-style workflow for Incidents
('Incident Management Workflow', 'ITIL incident management process', 'incident', 'new',
  '[
    {"status": "new", "name": "New", "category": "open"},
    {"status": "assigned", "name": "Assigned", "category": "open"},
    {"status": "investigating", "name": "Investigating", "category": "in_progress"},
    {"status": "on_hold", "name": "On Hold", "category": "in_progress"},
    {"status": "resolved", "name": "Resolved", "category": "resolved"},
    {"status": "closed", "name": "Closed", "category": "closed"}
  ]'::jsonb,
  '{
    "new": ["assigned"],
    "assigned": ["investigating", "on_hold"],
    "investigating": ["on_hold", "resolved"],
    "on_hold": ["investigating"],
    "resolved": ["closed", "investigating"],
    "closed": ["investigating"]
  }'::jsonb,
  true
),

-- ServiceNow-style workflow for Changes
('Change Management Workflow', 'ITIL change management with approvals', 'change', 'new',
  '[
    {"status": "new", "name": "New", "category": "draft"},
    {"status": "awaiting_approval", "name": "Awaiting Approval", "category": "approval"},
    {"status": "approved", "name": "Approved", "category": "approved"},
    {"status": "scheduled", "name": "Scheduled", "category": "scheduled"},
    {"status": "implementing", "name": "Implementing", "category": "in_progress"},
    {"status": "resolved", "name": "Resolved", "category": "completed"},
    {"status": "closed", "name": "Closed", "category": "closed"},
    {"status": "cancelled", "name": "Cancelled", "category": "cancelled"}
  ]'::jsonb,
  '{
    "new": ["awaiting_approval", "cancelled"],
    "awaiting_approval": ["approved", "cancelled"],
    "approved": ["scheduled", "cancelled"],
    "scheduled": ["implementing"],
    "implementing": ["resolved"],
    "resolved": ["closed"],
    "closed": []
  }'::jsonb,
  true
);

-- Insert default workflow transitions
-- Software Development Workflow (ID: 1)
INSERT INTO workflow_transitions (
  workflow_id, name, from_status, to_status, button_text, button_color, icon, conditions, actions
) VALUES
  (1, 'Start Development', 'backlog', 'selected_for_development', 'Select for Dev', 'blue', 'play', '{}', '[]'),
  (1, 'Begin Work', 'selected_for_development', 'in_progress', 'Start', 'green', 'code', '{"required_fields": ["assignee_id"]}', '[{"action": "assign", "field": "status"}]'),
  (1, 'Move to Backlog', 'selected_for_development', 'backlog', 'Back to Backlog', 'gray', 'arrow-left', '{}', '[]'),
  (1, 'Submit for Review', 'in_progress', 'in_review', 'Submit Review', 'purple', 'eye', '{}', '[{"action": "add_comment", "text": "Submitted for code review"}]'),
  (1, 'Send to QA', 'in_review', 'in_qa', 'Send to QA', 'yellow', 'test-tube', '{}', '[]'),
  (1, 'Back to Development', 'in_review', 'in_progress', 'Needs Work', 'orange', 'arrow-left', '{}', '[]'),
  (1, 'Mark Resolved', 'in_qa', 'resolved', 'Resolve', 'green', 'check', '{"required_fields": ["resolution_notes"]}', '[{"action": "set_field", "field": "resolved_at", "value": "now"}]'),
  (1, 'Close Ticket', 'resolved', 'closed', 'Close', 'gray', 'x', '{}', '[]'),
  (1, 'Reopen', 'closed', 'in_progress', 'Reopen', 'red', 'rotate-ccw', '{}', '[]');

-- Incident Management Workflow (ID: 2)
INSERT INTO workflow_transitions (
  workflow_id, name, from_status, to_status, button_text, button_color, icon, required_role, actions
) VALUES
  (2, 'Assign Incident', 'new', 'assigned', 'Assign', 'blue', 'user', 'admin', '[{"action": "notify", "target": "assignee"}]'),
  (2, 'Start Investigation', 'assigned', 'investigating', 'Investigate', 'purple', 'search', NULL, '[{"action": "add_comment", "text": "Investigation started"}]'),
  (2, 'Put On Hold', 'assigned', 'on_hold', 'On Hold', 'yellow', 'pause', NULL, '[]'),
  (2, 'Resume Investigation', 'on_hold', 'investigating', 'Resume', 'green', 'play', NULL, '[]'),
  (2, 'Resolve Incident', 'investigating', 'resolved', 'Resolve', 'green', 'check', NULL, '[{"action": "set_field", "field": "resolved_at", "value": "now"}]'),
  (2, 'Close Incident', 'resolved', 'closed', 'Close', 'gray', 'x', NULL, '[]'),
  (2, 'Reopen Incident', 'closed', 'investigating', 'Reopen', 'red', 'rotate-ccw', NULL, '[]');

-- Change Management Workflow (ID: 3) - With Approvals
INSERT INTO workflow_transitions (
  workflow_id, name, from_status, to_status, button_text, button_color, icon, requires_approval, approval_role, actions
) VALUES
  (3, 'Submit for Approval', 'new', 'awaiting_approval', 'Submit', 'blue', 'send', true, 'admin', '[{"action": "notify", "target": "approvers"}]'),
  (3, 'Approve Change', 'awaiting_approval', 'approved', 'Approve', 'green', 'check-circle', false, 'admin', '[{"action": "notify", "target": "reporter"}]'),
  (3, 'Schedule Change', 'approved', 'scheduled', 'Schedule', 'purple', 'calendar', false, NULL, '[]'),
  (3, 'Begin Implementation', 'scheduled', 'implementing', 'Implement', 'orange', 'play', false, NULL, '[{"action": "add_comment", "text": "Implementation started"}]'),
  (3, 'Mark Complete', 'implementing', 'resolved', 'Complete', 'green', 'check', false, NULL, '[{"action": "set_field", "field": "resolved_at", "value": "now"}]'),
  (3, 'Close Change', 'resolved', 'closed', 'Close', 'gray', 'x', false, NULL, '[]'),
  (3, 'Cancel Change', 'new', 'cancelled', 'Cancel', 'red', 'x-circle', false, NULL, '[]'),
  (3, 'Cancel Change', 'awaiting_approval', 'cancelled', 'Cancel', 'red', 'x-circle', false, NULL, '[]'),
  (3, 'Cancel Change', 'approved', 'cancelled', 'Cancel', 'red', 'x-circle', false, 'admin', '[]');
