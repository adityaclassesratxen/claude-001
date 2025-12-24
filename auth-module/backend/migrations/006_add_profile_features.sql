-- Add avatar and preferences to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS job_title VARCHAR(100),
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS marketing_emails BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);

-- Create login_history table
CREATE TABLE IF NOT EXISTS login_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device VARCHAR(100),
  browser VARCHAR(100),
  os VARCHAR(100),
  location VARCHAR(255),
  success BOOLEAN DEFAULT TRUE,
  failure_reason VARCHAR(255),
  logout_at TIMESTAMP
);

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INTEGER,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_sessions table (for active sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device VARCHAR(100),
  browser VARCHAR(100),
  os VARCHAR(100),
  ip_address VARCHAR(45),
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(login_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id INTEGER,
  p_action VARCHAR,
  p_resource_type VARCHAR DEFAULT NULL,
  p_resource_id INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO activity_log (user_id, action, resource_type, resource_id, description, metadata)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_description, p_metadata);
END;
$$ LANGUAGE plpgsql;

-- Function to clean old login history (keep last 100 per user)
CREATE OR REPLACE FUNCTION clean_old_login_history() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM login_history 
  WHERE id IN (
    SELECT id FROM login_history 
    WHERE user_id = NEW.user_id 
    ORDER BY login_at DESC 
    OFFSET 100
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clean_login_history
AFTER INSERT ON login_history
FOR EACH ROW
EXECUTE FUNCTION clean_old_login_history();

-- Sample data for testing
-- Insert some login history
INSERT INTO login_history (user_id, ip_address, device, browser, os, location)
SELECT 
  1,
  '192.168.1.' || (random() * 255)::int,
  CASE (random() * 3)::int
    WHEN 0 THEN 'Desktop'
    WHEN 1 THEN 'Mobile'
    ELSE 'Tablet'
  END,
  CASE (random() * 3)::int
    WHEN 0 THEN 'Chrome'
    WHEN 1 THEN 'Firefox'
    ELSE 'Safari'
  END,
  CASE (random() * 3)::int
    WHEN 0 THEN 'Windows'
    WHEN 1 THEN 'macOS'
    ELSE 'Linux'
  END,
  'San Francisco, CA'
FROM generate_series(1, 20);

-- Insert some activity logs
INSERT INTO activity_log (user_id, action, resource_type, resource_id, description)
VALUES 
  (1, 'user.login', NULL, NULL, 'User logged in successfully'),
  (1, 'user.updated', 'user', 1, 'Updated profile information'),
  (1, 'tenant.created', 'tenant', 1, 'Created new tenant'),
  (1, 'user.created', 'user', 2, 'Created new user');
