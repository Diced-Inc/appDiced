-- Migration: histórico acumulativo + extrato mensal + dedup de notificações
-- Rodar ANTES de deployar o código que usa upsert (fase 0/1).

-- ============================================================
-- 1. daily_revenue vira livro-razão: impressions + unique (app_id, date)
-- ============================================================
ALTER TABLE daily_revenue ADD COLUMN IF NOT EXISTS impressions BIGINT NOT NULL DEFAULT 0;

-- Dedupe antes do índice único (delete+insert antigo pode ter deixado duplicatas)
DELETE FROM daily_revenue a
USING daily_revenue b
WHERE a.app_id = b.app_id
  AND a.date = b.date
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_revenue_app_date
  ON daily_revenue (app_id, date);

-- ============================================================
-- 2. ad_unit_revenue: série diária acumulativa
--    NOTA: o índice idx_ad_unit_revenue_unique JÁ EXISTIA (migration-ad-units.sql) com
--    (user_id, ad_unit_id, period_start, period_end) — o código usa esse onConflict.
-- ============================================================
DELETE FROM ad_unit_revenue a
USING ad_unit_revenue b
WHERE a.user_id = b.user_id
  AND a.ad_unit_id = b.ad_unit_id
  AND a.period_start = b.period_start
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_unit_revenue_unique
  ON ad_unit_revenue (user_id, ad_unit_id, period_start);

-- ============================================================
-- 3. country_revenue: deixa de ser snapshot 30d, vira série diária
--    NOTA: idx_country_revenue_unique JÁ EXISTIA (migration-country.sql) com period_end;
--    o CREATE abaixo é no-op e o código usa as 4 colunas no onConflict.
--    (dados antigos são agregados de 30d — incompatíveis; o sync reconstrói)
-- ============================================================
TRUNCATE country_revenue;

CREATE UNIQUE INDEX IF NOT EXISTS idx_country_revenue_unique
  ON country_revenue (user_id, country_code, period_start);

-- ============================================================
-- 4. monthly_earnings: extrato mensal do AdMob
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  month DATE NOT NULL,                      -- primeiro dia do mês (2026-08-01)
  gross NUMERIC(12,2) NOT NULL DEFAULT 0,   -- derivado de daily_revenue
  status TEXT NOT NULL DEFAULT 'open',      -- open | closed | paid
  paid_at DATE,
  paid_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_earnings_user ON monthly_earnings (user_id, month DESC);

-- ============================================================
-- 5. notifications_sent: dedup de notificações
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications_sent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,          -- revenue_drop | app_status | threshold | payment_due | sync_stale
  key TEXT NOT NULL,           -- chave de dedup (ex.: data, package, mês)
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, kind, key)
);

-- ============================================================
-- 6. withdrawals: vínculo opcional com o mês do extrato
-- ============================================================
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS month DATE;

-- ============================================================
-- 7. RPC: agregação de receita por país no Postgres
--    (evita puxar milhares de linhas diárias pro app)
-- ============================================================
CREATE OR REPLACE FUNCTION country_revenue_totals(
  p_user_id TEXT,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS TABLE(country_code TEXT, revenue NUMERIC, impressions BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT
    cr.country_code::text,
    SUM(cr.revenue)::numeric AS revenue,
    SUM(cr.impressions)::bigint AS impressions
  FROM country_revenue cr
  WHERE cr.user_id = p_user_id
    AND (p_from IS NULL OR cr.period_start::date >= p_from)
    AND (p_to IS NULL OR cr.period_start::date <= p_to)
  GROUP BY cr.country_code
  ORDER BY 2 DESC
$$;

-- ============================================================
-- (OPCIONAL, rodar SÓ depois do deploy da fase 1 estar no ar)
-- As colunas de janela 30d em apps deixam de ser usadas pelo código:
-- ALTER TABLE apps DROP COLUMN revenue;
-- ALTER TABLE apps DROP COLUMN impressions;
-- ALTER TABLE apps DROP COLUMN ecpm;
-- ============================================================
