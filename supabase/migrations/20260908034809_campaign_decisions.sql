-- Append-only decisions and observed Meta configuration; Clerk authorization
-- is enforced in server routes before service-role access.
create table public.campaign_history (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.marketing_integrations(id) on delete cascade,
  user_id text not null,
  kind text not null check (kind in ('decision', 'observation')),
  note text check (char_length(note) between 1 and 2000),
  snapshot jsonb,
  created_at timestamptz not null default now(),
  check ((kind = 'decision' and note is not null) or (kind = 'observation' and snapshot is not null))
);
create index campaign_history_owner_idx on public.campaign_history(user_id, integration_id, created_at desc);
alter table public.campaign_history enable row level security;
revoke all on public.campaign_history from public, anon, authenticated;
grant select, insert on public.campaign_history to service_role;

create function public.record_campaign_observation(p_integration_id uuid, p_user_id text, p_snapshot jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare previous jsonb;
begin
  if not exists (select 1 from public.marketing_integrations where id = p_integration_id and user_id = p_user_id) then
    raise exception 'Integration unavailable';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_integration_id::text, 0));
  select snapshot into previous from public.campaign_history
    where integration_id = p_integration_id and user_id = p_user_id and kind = 'observation'
    order by created_at desc limit 1;
  if previous is distinct from p_snapshot then
    insert into public.campaign_history(integration_id, user_id, kind, snapshot)
      values(p_integration_id, p_user_id, 'observation', p_snapshot);
  end if;
end;
$$;
revoke all on function public.record_campaign_observation(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_campaign_observation(uuid, text, jsonb) to service_role;
