-- O Diced usa Clerk para autenticação e acessa o Supabase somente no backend
-- com a service_role. Nenhuma tabela de negócio precisa estar disponível para
-- os papéis públicos do Data API.

begin;

alter table public.ad_unit_revenue enable row level security;
alter table public.api_connections enable row level security;
alter table public.apps enable row level security;
alter table public.country_revenue enable row level security;
alter table public.daily_revenue enable row level security;
alter table public.marketing_daily_metrics enable row level security;
alter table public.marketing_integrations enable row level security;
alter table public.monthly_earnings enable row level security;
alter table public.notifications_sent enable row level security;
alter table public.pipeline_apps enable row level security;
alter table public.pipeline_insights enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.revenue_snapshots enable row level security;
alter table public.sync_log enable row level security;
alter table public.withdrawals enable row level security;

-- Remove a exposição histórica criada pelos privilégios padrão do Supabase.
-- Sem grants e sem policies, anon/authenticated não alcançam nenhuma linha.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

-- O backend precisa apenas de DML; operações de estrutura continuam restritas
-- ao postgres usado nas migrations.
revoke all privileges on all tables in schema public from service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Evita que objetos futuros voltem a nascer expostos enquanto a alteração de
-- defaults do Data API ainda está sendo distribuída pela plataforma.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- Mantém a RPC server-side compatível com search_path vazio, eliminando a
-- possibilidade de shadowing de objetos e o alerta do Security Advisor.
create or replace function public.country_revenue_totals(
  p_user_id text,
  p_from date default null,
  p_to date default null
)
returns table(country_code text, revenue numeric, impressions bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    cr.country_code::text,
    sum(cr.revenue)::numeric as revenue,
    sum(cr.impressions)::bigint as impressions
  from public.country_revenue as cr
  where cr.user_id = p_user_id
    and (p_from is null or cr.period_start::date >= p_from)
    and (p_to is null or cr.period_start::date <= p_to)
  group by cr.country_code
  order by 2 desc
$$;

revoke all privileges on function public.country_revenue_totals(text, date, date)
  from public, anon, authenticated;
grant execute on function public.country_revenue_totals(text, date, date)
  to service_role;

commit;
