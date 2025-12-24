-- ============================================
-- ENHANCED SLA TRACKING SYSTEM
-- ============================================

-- Create SLA metric types
CREATE TYPE sla_metric_type AS ENUM (
  'response_time',
  'resolution_time',
  'acknowledgment_time'
);

-- Create SLA status
CREATE TYPE sla_status AS ENUM (
  'not_started',
  'in_progress',
  'paused',
  'completed',
  'breached'
);

-- Business hours configuration
CREATE TABLE IF NOT EXISTS business_hours (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tenant_id INTEGER REFERENCES tenants(id),
  timezone VARCHAR(100) DEFAULT 'UTC',
  monday JSONB DEFAULT '{"start": "09:00", "end": "17:00", "working": true}',
  tuesday JSONB DEFAULT '{"start": "09:00", "end": "17:00", "working": true}',
  wednesday JSONB DEFAULT '{"start": "09:00", "end": "17:00", "working": true}',
  thursday JSONB DEFAULT '{"start": "09:00", "end": "17:00", "working": true}',
  friday JSONB DEFAULT '{"start": "09:00", "end": "17:00", "working": true}',
  saturday JSONB DEFAULT '{"start": "09:00", "end": "17:00", "working": false}',
  sunday JSONB DEFAULT '{"start": "09:00", "end": "17:00", "working": false}',
  holidays JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced SLA definitions
ALTER TABLE sla_definitions 
ADD COLUMN IF NOT EXISTS metric_type sla_metric_type DEFAULT 'resolution_time',
ADD COLUMN IF NOT EXISTS business_hours_id INTEGER REFERENCES business_hours(id),
ADD COLUMN IF NOT EXISTS use_business_hours BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS auto_escalate BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS escalation_user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS escalation_hours INTEGER,
ADD COLUMN IF NOT EXISTS notification_thresholds JSONB DEFAULT '[]';

-- SLA instances
CREATE TABLE IF NOT EXISTS ticket_slas (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sla_definition_id INTEGER REFERENCES sla_definitions(id),
  metric_type sla_metric_type NOT NULL,
  target_hours DECIMAL(10,2) NOT NULL,
  status sla_status DEFAULT 'not_started',
  start_time TIMESTAMP NOT NULL,
  due_time TIMESTAMP NOT NULL,
  completion_time TIMESTAMP,
  pause_start_time TIMESTAMP,
  total_pause_duration INTERVAL DEFAULT '0 hours',
  pause_reason VARCHAR(500),
  paused_by INTEGER REFERENCES users(id),
  is_breached BOOLEAN DEFAULT FALSE,
  breach_time TIMESTAMP,
  breach_duration INTERVAL,
  actual_duration INTERVAL,
  business_hours_duration INTERVAL,
  notifications_sent JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SLA pause history
CREATE TABLE IF NOT EXISTS sla_pause_history (
  id SERIAL PRIMARY KEY,
  ticket_sla_id INTEGER NOT NULL REFERENCES ticket_slas(id) ON DELETE CASCADE,
  paused_at TIMESTAMP NOT NULL,
  resumed_at TIMESTAMP,
  pause_duration INTERVAL,
  pause_reason VARCHAR(500),
  paused_by INTEGER REFERENCES users(id),
  resumed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SLA escalations
CREATE TABLE IF NOT EXISTS sla_escalations (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_sla_id INTEGER REFERENCES ticket_slas(id) ON DELETE CASCADE,
  escalation_level INTEGER DEFAULT 1,
  escalated_to INTEGER REFERENCES users(id),
  escalation_reason TEXT,
  escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP
);

-- SLA notifications log
CREATE TABLE IF NOT EXISTS sla_notifications (
  id SERIAL PRIMARY KEY,
  ticket_sla_id INTEGER NOT NULL REFERENCES ticket_slas(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  threshold_percentage INTEGER,
  sent_to INTEGER[] NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notification_data JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_business_hours_tenant ON business_hours(tenant_id);
CREATE INDEX idx_sla_definitions_type_priority ON sla_definitions(ticket_type, priority);
CREATE INDEX idx_ticket_slas_ticket ON ticket_slas(ticket_id);
CREATE INDEX idx_ticket_slas_status ON ticket_slas(status);
CREATE INDEX idx_ticket_slas_due ON ticket_slas(due_time);
CREATE INDEX idx_ticket_slas_breached ON ticket_slas(is_breached);
CREATE INDEX idx_sla_pause_history_sla ON sla_pause_history(ticket_sla_id);
CREATE INDEX idx_sla_escalations_ticket ON sla_escalations(ticket_id);
CREATE INDEX idx_sla_notifications_sla ON sla_notifications(ticket_sla_id);

-- Function to calculate business hours (simplified)
CREATE OR REPLACE FUNCTION calculate_business_hours(
  p_start_time TIMESTAMP,
  p_end_time TIMESTAMP,
  p_business_hours_id INTEGER
) RETURNS INTERVAL AS $$
DECLARE
  v_total_minutes INTEGER := 0;
  v_current_date DATE;
  v_end_date DATE;
  v_day_name TEXT;
  v_day_config JSONB;
  v_working BOOLEAN;
BEGIN
  v_current_date := p_start_time::DATE;
  v_end_date := p_end_time::DATE;
  IF p_business_hours_id IS NULL THEN
    RETURN p_end_time - p_start_time;
  END IF;

  WHILE v_current_date <= v_end_date LOOP
    v_day_name := TRIM(LOWER(TO_CHAR(v_current_date, 'Day')));
    EXECUTE format('SELECT %I FROM business_hours WHERE id = $1', v_day_name)
    INTO v_day_config
    USING p_business_hours_id;
    v_working := (v_day_config->>'working')::BOOLEAN;
    IF v_working THEN
      v_total_minutes := v_total_minutes + 480;
    END IF;
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  RETURN (v_total_minutes || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Enhanced SLA due time calculation
CREATE OR REPLACE FUNCTION calculate_sla_due_time_enhanced(
  p_start_time TIMESTAMP,
  p_target_hours DECIMAL,
  p_business_hours_id INTEGER DEFAULT NULL
) RETURNS TIMESTAMP AS $$
DECLARE
  v_due_time TIMESTAMP;
  v_use_business_hours BOOLEAN := FALSE;
BEGIN
  IF p_business_hours_id IS NOT NULL THEN
    SELECT use_business_hours INTO v_use_business_hours
    FROM sla_definitions
    WHERE business_hours_id = p_business_hours_id
    LIMIT 1;
  END IF;

  IF v_use_business_hours THEN
    v_due_time := p_start_time + (p_target_hours || ' hours')::INTERVAL;
    WHILE EXTRACT(DOW FROM v_due_time) IN (0, 6) LOOP
      v_due_time := v_due_time + INTERVAL '1 day';
    END LOOP;
  ELSE
    v_due_time := p_start_time + (p_target_hours || ' hours')::INTERVAL;
  END IF;

  RETURN v_due_time;
END;
$$ LANGUAGE plpgsql;

-- SLA status trigger
CREATE OR REPLACE FUNCTION check_sla_status() RETURNS TRIGGER AS $$
DECLARE
  v_now TIMESTAMP := CURRENT_TIMESTAMP;
  v_time_remaining INTERVAL;
  v_percent_elapsed DECIMAL;
BEGIN
  IF NEW.status IN ('completed', 'breached') OR NEW.status = 'paused' THEN
    RETURN NEW;
  END IF;

  v_time_remaining := NEW.due_time - v_now;

  IF v_now > NEW.due_time THEN
    NEW.status := 'breached';
    NEW.is_breached := TRUE;
    NEW.breach_time := v_now;
    NEW.breach_duration := v_now - NEW.due_time;
    INSERT INTO sla_notifications (ticket_sla_id, notification_type, threshold_percentage, sent_to)
    VALUES (NEW.id, 'breached', 100, ARRAY[1]);
  ELSE
    v_percent_elapsed := (EXTRACT(EPOCH FROM (v_now - NEW.start_time)) /
                          EXTRACT(EPOCH FROM (NEW.due_time - NEW.start_time))) * 100;
    IF v_percent_elapsed >= 75 AND NOT EXISTS (
      SELECT 1 FROM sla_notifications 
      WHERE ticket_sla_id = NEW.id AND notification_type = 'warning_75'
    ) THEN
      INSERT INTO sla_notifications (ticket_sla_id, notification_type, threshold_percentage, sent_to)
      VALUES (NEW.id, 'warning_75', 75, ARRAY[1]);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_sla_status
BEFORE UPDATE ON ticket_slas
FOR EACH ROW
EXECUTE FUNCTION check_sla_status();

-- Auto-create SLA on ticket creation
CREATE OR REPLACE FUNCTION create_ticket_sla() RETURNS TRIGGER AS $$
DECLARE
  v_sla_def RECORD;
  v_due_time TIMESTAMP;
BEGIN
  SELECT * INTO v_sla_def
  FROM sla_definitions
  WHERE ticket_type = NEW.type
    AND priority = NEW.priority
    AND is_active = TRUE
    AND (tenant_id IS NULL OR tenant_id = NEW.tenant_id)
  ORDER BY tenant_id DESC NULLS LAST
  LIMIT 1;
  
  IF FOUND THEN
    v_due_time := calculate_sla_due_time_enhanced(
      CURRENT_TIMESTAMP,
      v_sla_def.resolution_time_hours,
      v_sla_def.business_hours_id
    );
    INSERT INTO ticket_slas (
      ticket_id,
      sla_definition_id,
      metric_type,
      target_hours,
      start_time,
      due_time,
      status
    ) VALUES (
      NEW.id,
      v_sla_def.id,
      v_sla_def.metric_type,
      v_sla_def.resolution_time_hours,
      CURRENT_TIMESTAMP,
      v_due_time,
      'in_progress'
    );
    UPDATE tickets SET sla_due_time = v_due_time WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_ticket_sla
AFTER INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION create_ticket_sla();

-- Seed data
INSERT INTO business_hours (name, is_default) VALUES
  ('Standard Business Hours (9-5, Mon-Fri)', true)
ON CONFLICT DO NOTHING;

UPDATE sla_definitions SET
  metric_type = 'resolution_time',
  use_business_hours = true,
  business_hours_id = (SELECT id FROM business_hours WHERE is_default = true LIMIT 1);

INSERT INTO sla_definitions (
  name, ticket_type, priority, 
  response_time_hours, resolution_time_hours,
  metric_type, use_business_hours, auto_escalate, escalation_hours
) VALUES
  ('Critical Response SLA', 'incident', 'critical', 0.5, 4, 'response_time', true, true, 2),
  ('High Response SLA', 'incident', 'high', 1, 8, 'response_time', true, true, 4),
  ('Critical Problem SLA', 'problem', 'critical', 2, 48, 'resolution_time', true, false, NULL),
  ('High Problem SLA', 'problem', 'high', 4, 72, 'resolution_time', true, false, NULL),
  ('Standard Change SLA', 'change', 'medium', 24, 168, 'resolution_time', true, false, NULL),
  ('Emergency Change SLA', 'change', 'critical', 1, 8, 'resolution_time', false, true, 4)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW sla_metrics_view AS
SELECT 
  t.type as ticket_type,
  t.priority,
  COUNT(ts.id) as total_slas,
  COUNT(ts.id) FILTER (WHERE ts.status = 'in_progress') as in_progress,
  COUNT(ts.id) FILTER (WHERE ts.status = 'completed') as completed,
  COUNT(ts.id) FILTER (WHERE ts.is_breached = true) as breached,
  ROUND(AVG(EXTRACT(EPOCH FROM ts.actual_duration) / 3600), 2) as avg_resolution_hours,
  ROUND((COUNT(ts.id) FILTER (WHERE ts.is_breached = false)::DECIMAL / 
         NULLIF(COUNT(ts.id), 0)) * 100, 2) as sla_compliance_percentage
FROM tickets t
LEFT JOIN ticket_slas ts ON t.id = ts.ticket_id
WHERE t.is_deleted = false
GROUP BY t.type, t.priority;
