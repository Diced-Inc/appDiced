-- Ad unit revenue breakdown
CREATE TABLE IF NOT EXISTS ad_unit_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  ad_unit_id TEXT NOT NULL,
  ad_unit_name TEXT NOT NULL DEFAULT '',
  revenue NUMERIC(10,4) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_unit_revenue_unique
  ON ad_unit_revenue (user_id, ad_unit_id, period_start, period_end);
