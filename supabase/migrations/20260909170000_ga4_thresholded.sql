-- O GA4 omite linhas quando o volume de usuários é baixo (limite de privacidade).
-- Sem este sinal, um dia omitido é indistinguível de um dia com receita zero.
-- A coleta grava o flag num upsert tolerante: enquanto esta migration não estiver
-- aplicada, o sync continua funcionando e apenas registra o aviso.

alter table public.marketing_daily_metrics
  add column if not exists ga4_thresholded boolean not null default false;

comment on column public.marketing_daily_metrics.ga4_thresholded is
  'true quando o GA4 aplicou limite de privacidade e nao devolveu linha para o dia; a receita registrada nao e um zero confirmado';
