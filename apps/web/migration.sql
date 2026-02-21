-- Multi-tenancy: add user_id to all tables
ALTER TABLE apps ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE api_connections ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Remove unique constraint on provider (now per-user)
ALTER TABLE api_connections DROP CONSTRAINT IF EXISTS api_connections_provider_key;

-- Add composite unique constraint (provider + user_id)
ALTER TABLE api_connections ADD CONSTRAINT api_connections_provider_user_id_key UNIQUE (provider, user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_apps_user_id ON apps(user_id);
CREATE INDEX IF NOT EXISTS idx_api_connections_user_id ON api_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_user_id ON sync_log(user_id);
