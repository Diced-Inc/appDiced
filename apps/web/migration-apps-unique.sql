-- Fix: allow same package_name for different users (multi-tenancy)
-- Drop single-column unique constraint on package_name if it exists
ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_package_name_key;
DROP INDEX IF EXISTS idx_apps_package_name;
DROP INDEX IF EXISTS apps_package_name_key;

-- Add composite unique constraint (package_name + user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_package_name_user_id
  ON apps (package_name, user_id);
