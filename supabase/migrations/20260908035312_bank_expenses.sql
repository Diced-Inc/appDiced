create table public.bank_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  occurred_on date not null,
  description text not null check (char_length(description) between 1 and 200),
  category text not null check (category in ('software', 'services', 'taxes', 'other')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('BRL', 'USD')),
  voided_at timestamptz,
  created_at timestamptz not null default now()
);
create index bank_expenses_owner_month_idx on public.bank_expenses(user_id, occurred_on desc);
alter table public.bank_expenses enable row level security;
revoke all on public.bank_expenses from public, anon, authenticated;
grant select, insert, update on public.bank_expenses to service_role;

create table public.bank_month_rates (
  user_id text not null,
  month date not null check (extract(day from month) = 1),
  usd_brl numeric(12,6) not null check (usd_brl > 0 and usd_brl < 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table public.bank_month_rates enable row level security;
revoke all on public.bank_month_rates from public, anon, authenticated;
grant select, insert, update on public.bank_month_rates to service_role;
