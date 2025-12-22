-- Add additional fields for user management
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Add full-text search index
CREATE INDEX IF NOT EXISTS idx_users_search ON users USING gin(to_tsvector('english', name || ' ' || email));

-- Create view for user list (excluding sensitive data)
CREATE OR REPLACE VIEW user_list_view AS
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  u.status,
  u.phone,
  u.department,
  u.tenant_id,
  t.name as tenant_name,
  u.last_login,
  u.created_at,
  u.updated_at,
  u.is_deleted
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.is_deleted = FALSE;
