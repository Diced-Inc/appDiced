-- Revenue snapshots table (hourly captures for "yesterday at same time" comparison)
CREATE TABLE IF NOT EXISTS revenue_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  hour INTEGER NOT NULL,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_user_date ON revenue_snapshots (user_id, date, hour);

-- Unique constraint: one snapshot per user per date per hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_snapshots_unique ON revenue_snapshots (user_id, date, hour);
