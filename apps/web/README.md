# Diced Dashboard

Dashboard interno da Diced (`app.diced.com.br`): receita AdMob, status dos apps na Play Store, pipeline de lançamento e extrato de pagamentos.

## Stack

Next.js (App Router) · Clerk · Supabase · Recharts · Tailwind · Vercel

## Arquitetura de dados

- **`daily_revenue` é o livro-razão**: uma linha por app por dia, acumulativa, alimentada por upsert — nunca deletada. Todo número de receita da UI é agregação derivada dela (`lib/data.ts`).
- `country_revenue` e `ad_unit_revenue` seguem o mesmo modelo (série diária por usuário).
- `monthly_earnings` materializa o extrato mensal (aberto → fechado → pago) a partir do razão; a página Banco modela o ciclo real do AdMob (mês N pago ~dia 21 de N+1, threshold $100).
- Os campos `apps.revenue/impressions/ecpm` são legados — o código não lê nem escreve neles.

## Coleta

| Gatilho | Frequência | O que faz |
|---|---|---|
| cron-job.org → `GET /api/cron/sync` (`mode=hourly`) | de hora em hora | snapshot horário + AdMob lookback 7d |
| Vercel cron → `GET /api/cron/sync?mode=daily` | 1x/dia 04h BRT | AdMob lookback 90d + Play Store + fechamento mensal + notificações |
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
- `../notifications/rules.ts` — regras de push (queda anômala, app removido, threshold, sync parado) com dedup em `notifications_sent`

## Desenvolvimento

```bash
pnpm dev          # dev server
pnpm test         # vitest (lógica pura)
pnpm check-types  # tsc
pnpm build        # build de produção
```

Migrations são arquivos `migration-*.sql` na raiz de `apps/web`, executadas manualmente no Supabase (a mais recente: `migration-history.sql`).

Env: ver `.env.example`. `CRON_SECRET` protege os endpoints de cron.
