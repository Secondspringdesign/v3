-- Migration: Add account_uid to users table
-- Purpose: Store the Outseta account UID for organization/team-level identity

-- Add account_uid column (nullable since existing users won't have it until re-authentication)
ALTER TABLE users ADD COLUMN account_uid TEXT;

-- Index for account-level queries
CREATE INDEX idx_users_account ON users(account_uid);

-- Add comment for documentation
COMMENT ON COLUMN users.account_uid IS 'Outseta account UID representing the organization/team the user belongs to';
