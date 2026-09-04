-- Mantém a coorte UTM estrita nas colunas existentes e registra, em separado,
-- o fallback que o GA4 recebe da Meta como apps.facebook.com / fb4a.
-- Assim a interface pode mostrar a medição conservadora e a ampliada sem
-- fingir que ambas têm a mesma precisão de campanha.

alter table public.marketing_daily_metrics
  add column if not exists facebook_referral_ad_revenue numeric(14,4) not null default 0,
  add column if not exists facebook_referral_purchase_revenue numeric(14,4) not null default 0,
  add column if not exists facebook_referral_total_revenue numeric(14,4) not null default 0,
  add column if not exists facebook_referral_installs bigint not null default 0,
  add column if not exists facebook_referral_ad_impressions bigint not null default 0;

comment on column public.marketing_daily_metrics.facebook_referral_ad_revenue is
  'Receita de anúncios da coorte GA4 apps.facebook.com / fb4a, sem UTM exata.';
comment on column public.marketing_daily_metrics.facebook_referral_purchase_revenue is
  'Receita de compras da coorte GA4 apps.facebook.com / fb4a, sem UTM exata.';
comment on column public.marketing_daily_metrics.facebook_referral_total_revenue is
  'Receita total da coorte GA4 apps.facebook.com / fb4a, sem UTM exata.';
comment on column public.marketing_daily_metrics.facebook_referral_installs is
  'Novos usuários da coorte GA4 apps.facebook.com / fb4a, sem UTM exata.';
comment on column public.marketing_daily_metrics.facebook_referral_ad_impressions is
  'Impressões de anúncio geradas pela coorte GA4 apps.facebook.com / fb4a.';
