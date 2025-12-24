-- ============================================
-- UNIFIED TICKET SYSTEM
-- Combines Jira (work management) + ServiceNow (service management)
-- ============================================

-- Create ticket types enum
CREATE TYPE ticket_type AS ENUM (
  'epic',           -- Jira: Large initiatives
  'story',          -- Jira: User story
  'task',           -- Jira: Regular task
  'bug',            -- Jira: Defect
  'incident',       -- ServiceNow: Production issue
  'service_request',-- ServiceNow: User request
  'problem',        -- ServiceNow: Root cause
  'change'          -- ServiceNow: Change management
);

-- Create ticket priorities
CREATE TYPE ticket_priority AS ENUM (
  'critical',   -- P0 - Drop everything
  'high',       -- P1 - Urgent
  'medium',     -- P2 - Normal
  'low',        -- P3 - Can wait
  'planning'    -- P4 - Future
);

-- Create ticket statuses (universal workflow)
CREATE TYPE ticket_status AS ENUM (
  -- Common
  'open',
  'in_progress',
  'resolved',
  'closed',
  'cancelled',
  
  -- Jira specific
  'backlog',
  'selected_for_development',
  'in_review',
  'ready_for_qa',
  'in_qa',
  'ready_for_deployment',
  
  -- ServiceNow specific
  'new',
  'assigned',
  'investigating',
  'awaiting_approval',
  'approved',
  'scheduled',
  'implementing',
  'on_hold',
  'pending_customer',
  'resolved_by_caller'
);

-- Create severity levels (for incidents/problems)
CREATE TYPE severity_level AS ENUM (
  'sev1',  -- System down
  'sev2',  -- Major functionality broken
  'sev3',  -- Minor issue
  'sev4'   -- Cosmetic
);

-- Create impact levels (ServiceNow)
CREATE TYPE impact_level AS ENUM (
  'high',    -- Affects many users
  'medium',  -- Affects some users
  'low'      -- Affects few users
);

-- Create urgency levels (ServiceNow)
CREATE TYPE urgency_level AS ENUM (
  'high',
  'medium',
  'low'
);

-- Main tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_key VARCHAR(50) UNIQUE NOT NULL, -- e.g., PROJ-123, INC-456
  
  -- Basic Info
  title VARCHAR(500) NOT NULL,
  description TEXT,
  type ticket_type NOT NULL,
  
  -- Status & Priority
  status ticket_status DEFAULT 'open',
  priority ticket_priority DEFAULT 'medium',
  
  -- ServiceNow specific
  severity severity_level,
  impact impact_level,
  urgency urgency_level,
  
  -- Relationships
  parent_ticket_id INTEGER REFERENCES tickets(id),  -- Epic -> Stories, Problem -> Incidents
  tenant_id INTEGER REFERENCES tenants(id),
  project_id INTEGER,  -- Will create projects table
  
  -- Assignment
  reporter_id INTEGER REFERENCES users(id),
  assignee_id INTEGER REFERENCES users(id),
  team_id INTEGER,  -- For team assignment
  
  -- Jira specific fields
  story_points INTEGER,
  sprint_id INTEGER,  -- Will create sprints table
  epic_id INTEGER REFERENCES tickets(id),
  
  -- ServiceNow specific fields
  affected_service VARCHAR(255),
  configuration_item VARCHAR(255),  -- CI
  business_service VARCHAR(255),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  
  -- SLA tracking
  sla_start_time TIMESTAMP,
  sla_due_time TIMESTAMP,
  sla_response_time TIMESTAMP,
  sla_resolution_time TIMESTAMP,
  sla_breached BOOLEAN DEFAULT FALSE,
  
  -- Time tracking
  estimated_hours DECIMAL(10,2),
  actual_hours DECIMAL(10,2),
  remaining_hours DECIMAL(10,2),
  
  -- Resolution
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id),
  
  -- Additional metadata
  environment VARCHAR(50),  -- dev, staging, prod
  labels TEXT[],
  custom_fields JSONB DEFAULT '{}',
  
  -- Audit fields
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by INTEGER REFERENCES users(id)
);

-- Ticket comments/work notes
CREATE TABLE IF NOT EXISTS ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,  -- ServiceNow: Work notes vs Comments
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket watchers (people following the ticket)
CREATE TABLE IF NOT EXISTS ticket_watchers (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ticket_id, user_id)
);

-- Ticket links (relationships between tickets)
CREATE TABLE IF NOT EXISTS ticket_links (
  id SERIAL PRIMARY KEY,
  source_ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  target_ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  link_type VARCHAR(50) NOT NULL, -- blocks, is_blocked_by, relates_to, duplicates, etc.
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket history (audit trail of all changes)
CREATE TABLE IF NOT EXISTS ticket_history (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects (Jira concept)
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  project_key VARCHAR(20) UNIQUE NOT NULL,  -- e.g., PROJ, INC, CHG
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tenant_id INTEGER REFERENCES tenants(id),
  lead_id INTEGER REFERENCES users(id),
  type VARCHAR(50) DEFAULT 'software',  -- software, service_desk, operations
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sprints (Jira agile)
CREATE TABLE IF NOT EXISTS sprints (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  goal TEXT,
  project_id INTEGER REFERENCES projects(id),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'future',  -- future, active, closed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SLA definitions
CREATE TABLE IF NOT EXISTS sla_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ticket_type ticket_type,
  priority ticket_priority,
  response_time_hours INTEGER,  -- Time to first response
  resolution_time_hours INTEGER, -- Time to resolve
  tenant_id INTEGER REFERENCES tenants(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow definitions (customizable workflows)
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  ticket_type ticket_type,
  tenant_id INTEGER REFERENCES tenants(id),
  states JSONB NOT NULL,  -- Array of valid states
  transitions JSONB NOT NULL,  -- Valid state transitions with conditions
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_tickets_type ON tickets(type);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX idx_tickets_reporter ON tickets(reporter_id);
CREATE INDEX idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX idx_tickets_project ON tickets(project_id);
CREATE INDEX idx_tickets_created ON tickets(created_at);
CREATE INDEX idx_tickets_key ON tickets(ticket_key);
CREATE INDEX idx_tickets_parent ON tickets(parent_ticket_id);
CREATE INDEX idx_tickets_epic ON tickets(epic_id);
CREATE INDEX idx_tickets_sprint ON tickets(sprint_id);
CREATE INDEX idx_tickets_sla_due ON tickets(sla_due_time);

CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX idx_ticket_watchers_ticket ON ticket_watchers(ticket_id);
CREATE INDEX idx_ticket_watchers_user ON ticket_watchers(user_id);
CREATE INDEX idx_ticket_links_source ON ticket_links(source_ticket_id);
CREATE INDEX idx_ticket_links_target ON ticket_links(target_ticket_id);
CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);

-- Full-text search index
CREATE INDEX idx_tickets_search ON tickets USING gin(
  to_tsvector('english', title || ' ' || COALESCE(description, ''))
);

-- Function to generate ticket key
CREATE OR REPLACE FUNCTION generate_ticket_key(
  p_project_id INTEGER,
  p_ticket_type ticket_type
) RETURNS VARCHAR AS $$
DECLARE
  v_project_key VARCHAR(20);
  v_next_number INTEGER;
  v_ticket_key VARCHAR(50);
BEGIN
  -- Get project key
  SELECT project_key INTO v_project_key 
  FROM projects 
  WHERE id = p_project_id;
  
  -- If no project, use type-based prefix
  IF v_project_key IS NULL THEN
    CASE p_ticket_type
      WHEN 'incident' THEN v_project_key := 'INC';
      WHEN 'service_request' THEN v_project_key := 'REQ';
      WHEN 'problem' THEN v_project_key := 'PRB';
      WHEN 'change' THEN v_project_key := 'CHG';
      ELSE v_project_key := 'TICKET';
    END CASE;
  END IF;
  
  -- Get next number for this project
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(ticket_key, '[^0-9]', '', 'g'), '')::INTEGER
  ), 0) + 1
  INTO v_next_number
  FROM tickets
  WHERE ticket_key LIKE v_project_key || '%';
  
  -- Generate key
  v_ticket_key := v_project_key || '-' || v_next_number;
  
  RETURN v_ticket_key;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate SLA due time
CREATE OR REPLACE FUNCTION calculate_sla_due_time(
  p_ticket_type ticket_type,
  p_priority ticket_priority,
  p_tenant_id INTEGER
) RETURNS TIMESTAMP AS $$
DECLARE
  v_resolution_hours INTEGER;
  v_due_time TIMESTAMP;
BEGIN
  -- Get SLA definition
  SELECT resolution_time_hours INTO v_resolution_hours
  FROM sla_definitions
  WHERE ticket_type = p_ticket_type
    AND priority = p_priority
    AND tenant_id = p_tenant_id
    AND is_active = TRUE
  LIMIT 1;
  
  -- If no SLA found, use defaults
  IF v_resolution_hours IS NULL THEN
    CASE p_priority
      WHEN 'critical' THEN v_resolution_hours := 4;
      WHEN 'high' THEN v_resolution_hours := 24;
      WHEN 'medium' THEN v_resolution_hours := 72;
      WHEN 'low' THEN v_resolution_hours := 168;
      ELSE v_resolution_hours := 168;
    END CASE;
  END IF;
  
  -- Calculate due time (excluding weekends for now)
  v_due_time := CURRENT_TIMESTAMP + (v_resolution_hours || ' hours')::INTERVAL;
  
  RETURN v_due_time;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update ticket history
CREATE OR REPLACE FUNCTION track_ticket_changes() RETURNS TRIGGER AS $$
BEGIN
  -- Track status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.assignee_id, 'status', OLD.status::TEXT, NEW.status::TEXT);
  END IF;
  
  -- Track assignee changes
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.assignee_id, 'assignee_id', OLD.assignee_id::TEXT, NEW.assignee_id::TEXT);
  END IF;
  
  -- Track priority changes
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, NEW.assignee_id, 'priority', OLD.priority::TEXT, NEW.priority::TEXT);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_ticket_changes
AFTER UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION track_ticket_changes();

-- Trigger to check SLA breach
CREATE OR REPLACE FUNCTION check_sla_breach() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sla_due_time IS NOT NULL AND 
     CURRENT_TIMESTAMP > NEW.sla_due_time AND 
     NEW.status NOT IN ('resolved', 'closed', 'cancelled') THEN
    NEW.sla_breached := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_sla_breach
BEFORE UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION check_sla_breach();

-- Sample data: Create default projects
INSERT INTO projects (project_key, name, description, type) VALUES
  ('PROJ', 'General Project', 'Default software project', 'software'),
  ('INC', 'Incidents', 'Production incidents', 'service_desk'),
  ('REQ', 'Service Requests', 'User service requests', 'service_desk'),
  ('CHG', 'Changes', 'Change management', 'operations')
ON CONFLICT (project_key) DO NOTHING;

-- Sample data: Create default SLA definitions
INSERT INTO sla_definitions (name, ticket_type, priority, response_time_hours, resolution_time_hours) VALUES
  ('Critical Incident SLA', 'incident', 'critical', 1, 4),
  ('High Incident SLA', 'incident', 'high', 2, 8),
  ('Medium Incident SLA', 'incident', 'medium', 4, 24),
  ('Critical Bug SLA', 'bug', 'critical', 2, 8),
  ('High Bug SLA', 'bug', 'high', 4, 24),
  ('Service Request SLA', 'service_request', 'medium', 8, 72);

-- Sample data: Create some test tickets
DO $$
DECLARE
  v_project_id INTEGER;
  v_user_id INTEGER;
BEGIN
  -- Get first project and user
  SELECT id INTO v_project_id FROM projects WHERE project_key = 'PROJ' LIMIT 1;
  SELECT id INTO v_user_id FROM users LIMIT 1;
  
  -- Create sample tickets
  INSERT INTO tickets (
    ticket_key, title, description, type, status, priority, 
    project_id, reporter_id, assignee_id, created_by
  ) VALUES
    (
      'PROJ-1',
      'Build User Authentication System',
      'Implement JWT-based authentication with login, register, and password reset',
      'story',
      'in_progress',
      'high',
      v_project_id,
      v_user_id,
      v_user_id,
      v_user_id
    ),
    (
      'PROJ-2',
      'Design Dashboard Layout',
      'Create responsive dashboard with sidebar and top navigation',
      'task',
      'resolved',
      'medium',
      v_project_id,
      v_user_id,
      v_user_id,
      v_user_id
    ),
    (
      'INC-1',
      'Database Connection Timeout',
      'Production database experiencing connection timeouts during peak hours',
      'incident',
      'investigating',
      'critical',
      (SELECT id FROM projects WHERE project_key = 'INC'),
      v_user_id,
      v_user_id,
      v_user_id
    );
END $$;
