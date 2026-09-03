-- Aquisição paga: configuração por app/campanha e livro-razão diário.
-- O backend acessa estas tabelas exclusivamente com a service role. Clerk é o
-- provedor de identidade do app, portanto não usamos auth.uid() nas policies.

create table if not exists public.marketing_integrations (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  app_id uuid not null references public.apps(id) on delete cascade,
  meta_ad_account_id text not null,
  meta_ad_account_name text not null default '',
  meta_campaign_id text not null,
  meta_campaign_name text not null default '',
  ga4_property_id text not null,
  ga4_stream_id text not null,
  utm_source text not null default 'meta',
  utm_medium text not null default 'paid_social',
  utm_campaign text not null,
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  last_sync timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, app_id)
);

create index if not exists marketing_integrations_user_active_idx
  on public.marketing_integrations (user_id, active);

create table if not exists public.marketing_daily_metrics (
  id uuid default gen_random_uuid() primary key,
  integration_id uuid not null references public.marketing_integrations(id) on delete cascade,
  user_id text not null,
  app_id uuid not null references public.apps(id) on delete cascade,
  date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  spend numeric(14,4) not null default 0,
  attributed_ad_revenue numeric(14,4) not null default 0,
  attributed_purchase_revenue numeric(14,4) not null default 0,
  attributed_total_revenue numeric(14,4) not null default 0,
  meta_impressions bigint not null default 0,
  meta_reach bigint not null default 0,
  meta_clicks bigint not null default 0,
  meta_installs bigint not null default 0,
  ga4_installs bigint not null default 0,
  publisher_ad_impressions bigint not null default 0,
  synced_at timestamptz not null default now(),
  unique (integration_id, date)
);

create index if not exists marketing_daily_metrics_user_date_idx
  on public.marketing_daily_metrics (user_id, date desc);

create index if not exists marketing_daily_metrics_app_date_idx
  on public.marketing_daily_metrics (app_id, date desc);

alter table public.marketing_integrations enable row level security;
alter table public.marketing_daily_metrics enable row level security;

revoke all on table public.marketing_integrations from anon, authenticated;
revoke all on table public.marketing_daily_metrics from anon, authenticated;
grant select, insert, update, delete on table public.marketing_integrations to service_role;
grant select, insert, update, delete on table public.marketing_daily_metrics to service_role;
