CREATE TABLE IF NOT EXISTS pipeline_apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  package_name TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'code',
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pipeline_apps_user ON pipeline_apps (user_id);
