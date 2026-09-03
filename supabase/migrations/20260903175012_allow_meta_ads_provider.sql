alter table public.api_connections
  drop constraint if exists api_connections_provider_check;

alter table public.api_connections
  add constraint api_connections_provider_check
  check (provider in ('google_play', 'admob', 'meta_ads'));
