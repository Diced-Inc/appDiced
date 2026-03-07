# Banco (Balance/Withdrawals) Feature

## Overview
New `/banco` page showing available balance (total revenue minus withdrawals) with manual withdrawal registration.

## Approach
Saldo calculado em tempo real: `balance = sum(apps.revenue) - sum(withdrawals.amount)`. No persistent balance field — always derived from real data.

## Database
New table `withdrawals`:
- `id` UUID PK DEFAULT gen_random_uuid()
- `user_id` TEXT NOT NULL
- `amount` NUMERIC(10,2) NOT NULL
- `date` DATE NOT NULL
- `note` TEXT
- `created_at` TIMESTAMPTZ DEFAULT now()
- Index on `user_id`

## API Routes
- `GET /api/bank` — returns withdrawals list + calculated balance
- `POST /api/bank` — creates new withdrawal (amount, date, note)
- `DELETE /api/bank/[id]` — removes a withdrawal

## Page Layout (`/banco`)
### KPI Cards (3)
1. Saldo Disponivel (green) = totalRevenue - totalWithdrawals
2. Receita Total (lifetime) = sum of all apps.revenue
3. Total Sacado (red) = sum of withdrawals

### Actions
- "Registrar Saque" button opens modal with: amount (USD), date (default today), note (optional)

### Withdrawals History Table
Columns: Data, Valor, Nota, Ações (delete button)

## Navigation
New sidebar item between "Receita" and "Configuracoes":
- Icon: Landmark (lucide)
- Label: Banco
- Route: /banco

## Currency
All values in USD (matching AdMob).
