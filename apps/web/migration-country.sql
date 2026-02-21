-- Country revenue table for AdMob revenue by country
CREATE TABLE IF NOT EXISTS country_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  country_code TEXT NOT NULL,
  revenue NUMERIC(10,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_country_revenue_unique
  ON country_revenue (user_id, country_code, period_start, period_end);
