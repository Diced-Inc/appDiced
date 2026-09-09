# Diced Dashboard

Dashboard interno da Diced (`app.diced.com.br`): receita AdMob, status dos apps na Play Store, pipeline de lançamento e extrato de pagamentos.

Também inclui o painel de aquisição paga: gasto da Meta versus receita atribuída no Firebase/GA4, com lucro, ROAS e CPI por campanha.

## Stack

Next.js (App Router) · Clerk · Supabase · Recharts · Tailwind · Vercel

## Arquitetura de dados

- **`daily_revenue` é o livro-razão**: uma linha por app por dia, acumulativa, alimentada por upsert — nunca deletada. Todo número de receita da UI é agregação derivada dela (`lib/data.ts`).
- `country_revenue` e `ad_unit_revenue` seguem o mesmo modelo (série diária por usuário).
- `monthly_earnings` materializa o extrato mensal (aberto → fechado → pago) a partir do razão; a página Banco modela o ciclo real do AdMob (mês N pago ~dia 21 de N+1, threshold $100).
- Os campos `apps.revenue/impressions/ecpm` são legados — o código não lê nem escreve neles.
- `marketing_integrations` vincula app, campanha Meta, fluxo Android do GA4 e UTMs. `marketing_daily_metrics` guarda o cruzamento diário em uma moeda única (a moeda da conta Meta).

## Coleta

| Gatilho | Frequência | O que faz |
|---|---|---|
| cron-job.org → `GET /api/cron/sync` (`mode=hourly`) | de hora em hora | snapshot + AdMob 7d + Meta/GA4 14d |
| Vercel cron → `GET /api/cron/sync?mode=daily` | 1x/dia 04h BRT | AdMob e Meta/GA4 90d + Play Store + fechamento mensal + notificações |
| Load do dashboard | 1x por sessão | sync leve 7d (fallback) |

Ambos exigem header `Authorization: Bearer $CRON_SECRET`.

**Backfill** (reconstruir histórico): `POST /api/sync/admob` com `{"backfillFrom": "YYYY-MM-DD"}` (autenticado via Clerk — rodar logado no dashboard).

## Sync engine

Toda a lógica vive em `lib/sync/` (as rotas são cascas finas):

- `parse.ts` — parsers puros do relatório AdMob
- `persist.ts` — upsert em lote + fetch paginado
- `admob.ts` — `syncAdMob(userId, { lookbackDays | backfillFrom })`
- `play.ts` — scrape da Play (rating, downloads, removido/restaurado)
- `monthly.ts` — fechamento mensal
- `snapshot.ts` — snapshot horário ("Ontem nesse horário")
- `acquisition.ts` — gasto da Meta + receita/instalações atribuídas pelo GA4
- `../notifications/rules.ts` — regras de push (queda anômala, app removido, threshold, sync parado) com dedup em `notifications_sent`

## Desenvolvimento

```bash
pnpm dev          # dev server
pnpm test         # vitest (lógica pura)
pnpm check-types  # tsc
pnpm build        # build de produção
```

Migrations novas ficam em `supabase/migrations/`. Para aquisição, aplique `20260903152304_acquisition_profitability.sql` no Supabase antes do deploy.

Env: ver `.env.example`. `CRON_SECRET` protege os endpoints de cron.

## Configuração da aquisição

1. No Google Cloud do OAuth atual, habilite **Google Analytics Data API** e **Google Analytics Admin API**.
2. No app da Meta, adicione como URI de redirecionamento OAuth: `https://app.diced.com.br/api/auth/meta/callback` (e a URL local equivalente no desenvolvimento).
3. Configure `META_APP_ID`, `META_APP_SECRET` e mantenha `META_GRAPH_API_VERSION=v26.0`.
4. Depois do deploy, abra Configurações, reconecte o Google para conceder `analytics.readonly`, conecte a Meta e vincule campanha + fluxo GA4 + UTMs.

O relatório usa `firstUserSource`, `firstUserMedium` e `firstUserCampaignName`. Portanto, a UTM da configuração deve ser exatamente a mesma enviada no Play Install Referrer do anúncio.

## Persistência do investimento (08/09/2026)

Campanhas abre no mês corrente. Toda sincronização de aquisição cobre no mínimo o início do mês e a janela solicitada (14 dias normalmente, 90 no cron diário). Os registros anteriores permanecem em marketing_daily_metrics; o filtro de exibição não limita retenção. O gasto Meta é salvo antes de consultar GA4 e usa upsert por integração/data. Banco lê esses registros do mês e deduplica campanha/conta/data/moeda; não criar despesas manuais espelhando os mesmos gastos. O escopo são as campanhas vinculadas. Testes cobrem o mês completo, virada de ano e persistência diante de falha GA4/Meta.

