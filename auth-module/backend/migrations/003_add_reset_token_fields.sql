-- Add password reset fields to users table
ALTER TABLE users 
ADD COLUMN reset_token VARCHAR(255),
ADD COLUMN reset_token_expiry TIMESTAMP;

-- Add index for faster token lookup
CREATE INDEX idx_reset_token ON users(reset_token);
