# appDiced — Histórico acumulativo, Banco/extrato AdMob, coleta automática

**Data:** 2026-08-20
**Status:** Aprovado

## Problema

1. `daily_revenue`, `country_revenue` e `ad_unit_revenue` são **destruídas e reconstruídas** a cada sync com janela de 30 dias — histórico além de 30d não existe.
2. A página Banco calcula saldo como `soma(apps.revenue) − saques`, mas `apps.revenue` é a janela de 30d, não lifetime. O saldo degrada sozinho e não modela o ciclo real do AdMob (mês N fecha e é pago ~dia 21 de N+1, threshold $100).
3. Sync só roda com a aba aberta (AutoSync 5min) + 1 cron Vercel/dia às 03h BRT. O cron externo nunca foi configurado. Snapshots horários ("Ontem nesse horário") só existem nas horas em que o painel foi aberto.
4. `/api/sync/admob` (538 linhas) e `/api/cron/sync` (469) são lógica duplicada e já divergente.
5. Inserts linha a linha (lentos, risco de timeout); `revenueChange`/`downloadsChange` hardcoded em 0; linha AdMob não mapeada cai silenciosamente no primeiro app; `getAdUnitRevenue` sem filtro/limite.

## Princípio central

`daily_revenue` vira o **livro-razão**: acumulativo, upsert por `(app_id, date)`, nunca deletado. Todo número de receita na UI é agregação derivada dele. Os campos `apps.revenue/impressions/ecpm` deixam de ser fonte de dados (colunas ficam no banco por ora, código para de ler/escrever; drop opcional depois).

## Fases

### Fase 0 — Schema + parar de destruir

- `daily_revenue`: `+impressions BIGINT`, unique `(app_id, date)`; dedupe antes do índice.
- `ad_unit_revenue`: unique `(user_id, ad_unit_id, period_start)`.
- `country_revenue`: vira série diária (dimensões DATE+COUNTRY no relatório); truncar snapshot antigo; unique `(user_id, country_code, period_start)`.
- Novas tabelas: `monthly_earnings (user_id, month, gross, status open|closed|paid, paid_at, paid_amount, UNIQUE(user_id, month))` e `notifications_sent (user_id, kind, key, sent_at, UNIQUE(user_id, kind, key))`.
- Todos os delete+insert viram **upsert em lote** (chunks de 500).
- SQL entregue pro usuário rodar no Supabase (regra do projeto: DDL é do usuário).

### Fase 1 — Engine único de sync

```
lib/sync/parse.ts    → parsers puros do relatório AdMob (testáveis)
lib/sync/persist.ts  → upserts em lote
lib/sync/admob.ts    → syncAdMob(userId, { lookbackDays } | { backfillFrom })
lib/sync/play.ts     → syncPlayStore(userId)
lib/sync/monthly.ts  → recomputeMonthlyEarnings(userId)
```

- `/api/sync/admob` e `/api/cron/sync` viram cascas finas sobre o engine (~900 linhas duplicadas deletadas).
- Fallback silencioso `?? allApps[0]` removido — linha não mapeada gera aviso em `sync_log`, não receita no app errado.
- Backfill: `POST /api/sync/admob {backfillFrom: "YYYY-MM-DD"}` reconstrói o histórico em lotes mensais.
- Camada de dados: `getApps`/`getSummary` etc. agregam de `daily_revenue` por período; `DicedApp.revenue/impressions/ecpm` passam a ser valores computados do período pedido.

### Fase 2 — Coleta sem aba aberta

- `/api/cron/sync?mode=hourly` → snapshot horário + AdMob lookback 7d (todos os usuários conectados).
- `/api/cron/sync?mode=daily` → AdMob lookback 90d + Play Store + fechamento mensal + notificações.
- cron-job.org de hora em hora (hourly); cron Vercel diário existente aponta pro daily.
- `AutoSync`: mantém 1 sync leve no load (fallback quando cron externo cair) e `router.refresh()` periódico; remove o sync a cada 5min.

### Fase 3 — Banco = extrato AdMob

- `monthly_earnings.gross` sempre recalculado de `daily_revenue`. Mês corrente = `open`; mês anterior fechado = `closed`; `paid` quando o usuário marca.
- Marcar como pago registra também em `withdrawals` (histórico unificado; dados legados preservados).
- Página: **A receber** (closed não pagos), **Mês corrente** (parcial + projeção ritmo×dias restantes), **Recebido lifetime** (soma withdrawals), tabela mês a mês com previsão de pagamento (~dia 21 do mês seguinte) e botão marcar-pago, alerta de threshold $100.

### Fase 4 — Período na UI + números mortos

- Seletor `7d/30d/60d/90d/mês a mês/tudo` via searchParams em Visão Geral e Receita.
- `revenueChange`/`downloadsChange` = período atual vs período anterior de mesmo tamanho.
- `getAdUnitRevenue` com filtro de data e limite.

### Fase 5 — Notificações + saúde do sync

- `lib/notifications/rules.ts`: queda anômala (ontem < 50% da média 7d), app suspenso/removido, threshold $100 atingido, pagamento previsto, sync falhando >6h. Dedup via `notifications_sent`.
- Badge no header: último sync ok / falha há Xh (lê `sync_log` + `api_connections`).

## Testes

vitest cobrindo lógica pura: parse do relatório, agregação por período, fechamento mensal, regras de notificação. Rotas Next não são testadas.

## Config fora do código (usuário)

1. Rodar `migration-history.sql` no Supabase.
2. Criar cron no cron-job.org (URL + header Bearer CRON_SECRET, de hora em hora).
3. Confirmar `CRON_SECRET` setado na Vercel.
4. Rodar backfill uma vez pra reconstruir histórico.
