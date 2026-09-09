"use client";

import { useEffect, useState } from "react";
import { Card } from "@diced/ui/card";
import { ArrowRightLeft, Megaphone, Plus, ReceiptText, Scale, TrendingDown, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import { toBrazilDateStr } from "@/lib/date";
import type { Expense, MediaSpend } from "@/lib/bank-expenses";

interface Report {
  rateSource: "manual" | "frankfurter" | null;
  rateDate: string | null;
  rateError: string | null;
  grossUsd: number;
  media: MediaSpend[];
  expenses: Expense[];
  usdBrl: number | null;
  totals: Record<string, number>;
  expensesBrl: number | null;
  netBrl: number | null;
  unknown: boolean;
  mediaIncomplete: boolean;
  monitoredCampaigns: number;
}

const fmt = (amount: number | null, currency = "BRL") =>
  amount === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);

const field =
  "rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-sm text-white outline-none transition-colors focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/25";

const ghostButton =
  "rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-50";

const categories: Record<string, string> = {
  software: "Software e assinaturas",
  services: "Serviços",
  taxes: "Taxas e impostos",
  other: "Outros",
};

const categoryStyle: Record<string, string> = {
  software: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  services: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  taxes: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  other: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
};

const iconProps = { className: "h-4 w-4", strokeWidth: 1.75, "aria-hidden": true } as const;

const icons = {
  wallet: <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />,
  revenue: <TrendingUp {...iconProps} />,
  spend: <TrendingDown {...iconProps} />,
  balance: <Scale {...iconProps} />,
  exchange: <ArrowRightLeft {...iconProps} />,
  media: <Megaphone {...iconProps} />,
  receipt: <ReceiptText {...iconProps} />,
  plus: <Plus {...iconProps} />,
  alert: <TriangleAlert {...iconProps} />,
};

const tones = {
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-400",
    value: "text-emerald-300",
    glow: "from-emerald-500/[0.08]",
    hover: "hover:border-emerald-500/25",
  },
  rose: {
    chip: "bg-rose-500/10 text-rose-400",
    value: "text-rose-300",
    glow: "from-rose-500/[0.08]",
    hover: "hover:border-rose-500/25",
  },
  violet: {
    chip: "bg-violet-500/10 text-violet-400",
    value: "text-white",
    glow: "from-violet-500/[0.08]",
    hover: "hover:border-violet-500/25",
  },
  zinc: {
    chip: "bg-zinc-500/10 text-zinc-400",
    value: "text-zinc-300",
    glow: "from-white/[0.04]",
    hover: "hover:border-white/15",
  },
};

function StatTile({
  tone,
  icon,
  label,
  value,
  hint,
}: {
  tone: keyof typeof tones;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string | null;
}) {
  const t = tones[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors ${t.hover}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.glow} to-transparent`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
          <span className={`shrink-0 rounded-lg p-1.5 ${t.chip}`}>{icon}</span>
        </div>
        <p
          className={`mt-3 font-heading text-2xl font-bold leading-none tracking-tight tabular-nums ${t.value}`}
        >
          {value}
        </p>
        <p className="mt-1.5 min-h-4 text-xs text-zinc-500">{hint ?? ""}</p>
      </div>
    </div>
  );
}

function SectionTitle({
  tone,
  icon,
  title,
  hint,
  total,
}: {
  tone: keyof typeof tones;
  icon: React.ReactNode;
  title: string;
  hint?: string;
  total?: string | null;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${tones[tone].chip}`}>{icon}</span>
        <div>
          <h3 className="font-heading text-sm font-semibold text-white">{title}</h3>
          {hint && <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-zinc-500">{hint}</p>}
        </div>
      </div>
      {total && (
        <span className="shrink-0 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-300">
          {total}
        </span>
      )}
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3 text-sm text-amber-200"
    >
      <span className="mt-0.5 shrink-0 text-amber-400">{icons.alert}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-4" role="status" aria-label="Carregando gastos">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[104px] rounded-xl border border-white/5 bg-white/[0.03]" />
        ))}
      </div>
      <div className="h-2 rounded-full bg-white/[0.04]" />
      <div className="h-16 rounded-xl border border-white/5 bg-white/[0.03]" />
      <div className="space-y-2">
        <div className="h-10 rounded-lg bg-white/[0.03]" />
        <div className="h-10 rounded-lg bg-white/[0.03]" />
      </div>
    </div>
  );
}

function totalsLabel(totals: Record<string, number>) {
  const parts = Object.entries(totals)
    .filter(([, amount]) => amount !== 0)
    .map(([currency, amount]) => fmt(amount, currency));
  return parts.length ? parts.join(" · ") : null;
}

export function BankExpenses() {
  const [month, setMonth] = useState(toBrazilDateStr().slice(0, 7));
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data: Report | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bank/expenses?month=${encodeURIComponent(month)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Despesas indisponíveis.");
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ data: null, error: error.message, loading: false });
      });
    return () => controller.abort();
  }, [month, revision]);

  async function save(body: Record<string, unknown>, form?: HTMLFormElement) {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/bank/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao salvar.");
      if (form && !body.action) form.reset();
      setMessage("Salvo.");
      setRevision((n) => n + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const data = state.data;
  const isCurrentMonth = month === toBrazilDateStr().slice(0, 7);

  const grossBrl = data && data.usdBrl !== null ? data.grossUsd * data.usdBrl : null;
  const spendPct =
    grossBrl !== null && grossBrl > 0 && data?.expensesBrl !== null && data?.expensesBrl !== undefined
      ? Math.min(100, Math.max(0, (data.expensesBrl / grossBrl) * 100))
      : null;
  const marginPct =
    grossBrl !== null && grossBrl > 0 && data?.netBrl !== null && data?.netBrl !== undefined && !data.mediaIncomplete
      ? (data.netBrl / grossBrl) * 100
      : null;
  const negative = data?.netBrl !== null && data?.netBrl !== undefined && data.netBrl < 0;

  const mediaTotals: Record<string, number> = {};
  for (const row of data?.media ?? []) mediaTotals[row.currency] = (mediaTotals[row.currency] || 0) + row.spend;
  const mediaMax: Record<string, number> = {};
  for (const row of data?.media ?? [])
    mediaMax[row.currency] = Math.max(mediaMax[row.currency] || 0, Math.abs(row.spend));

  const manualTotals: Record<string, number> = {};
  for (const row of data?.expenses ?? [])
    if (!row.voided_at) manualTotals[row.currency] = (manualTotals[row.currency] || 0) + Number(row.amount);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="shrink-0 rounded-xl bg-violet-500/10 p-2.5 text-violet-400">{icons.wallet}</span>
          <div>
            <h2 className="font-heading text-base font-semibold text-white md:text-lg">
              Gastos e resultado do mês
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-400">
              Receita gerada menos mídia e despesas registradas.{" "}
              <span className="text-zinc-500">Não é o saldo da conta bancária.</span>
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Mês
          <input
            aria-label="Mês das despesas"
            type="month"
            value={month}
            max={toBrazilDateStr().slice(0, 7)}
            className={`${field} [color-scheme:dark]`}
            onChange={(event) => {
              setMonth(event.target.value);
              setState({ data: null, error: null, loading: true });
            }}
          />
        </label>
      </div>

      {state.loading && <Skeleton />}
      {state.error && (
        <div className="mt-4">
          <Alert>{state.error}</Alert>
        </div>
      )}

      {data && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              tone="emerald"
              icon={icons.revenue}
              label="Receita AdMob gerada"
              value={fmt(data.grossUsd, "USD")}
              hint={grossBrl !== null ? `≈ ${fmt(grossBrl)}` : "conversão indisponível"}
            />
            <StatTile
              tone="rose"
              icon={icons.spend}
              label="Gastos totais convertidos"
              value={fmt(data.expensesBrl)}
              hint={totalsLabel(data.totals) ? `por moeda: ${totalsLabel(data.totals)}` : "nenhum gasto registrado"}
            />
            <StatTile
              tone={data.mediaIncomplete ? "zinc" : negative ? "rose" : "violet"}
              icon={icons.balance}
              label="Saldo após gastos registrados"
              value={data.mediaIncomplete ? "—" : fmt(data.netBrl)}
              hint={
                marginPct !== null
                  ? `margem de ${marginPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% sobre a receita`
                  : "aguardando dados completos"
              }
            />
          </div>

          {spendPct !== null && !data.mediaIncomplete && (
            <div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="bg-gradient-to-r from-rose-500 to-rose-400 transition-[width] duration-500"
                  style={{ width: `${spendPct}%` }}
                />
                <div className="flex-1 bg-gradient-to-r from-emerald-500/60 to-emerald-400/60" />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  Gastos consomem {spendPct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% da receita
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {negative ? "Resultado negativo no mês" : `Sobram ${(100 - spendPct).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`}
                </span>
              </div>
            </div>
          )}

          {(data.mediaIncomplete || data.unknown) && (
            <Alert>
              {data.mediaIncomplete
                ? "Há campanhas sem sincronização válida; o resultado está incompleto."
                : "Há moeda sem conversão configurada; o saldo está indisponível."}
            </Alert>
          )}

          <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="shrink-0 rounded-lg bg-violet-500/10 p-1.5 text-violet-300">
                  {icons.exchange}
                </span>
                <div>
                  <p className="text-sm text-zinc-300">
                    {data.usdBrl === null ? (
                      "Cotação indisponível"
                    ) : (
                      <>
                        US${" "}
                        <strong className="font-heading tabular-nums text-white">
                          1 = R${" "}
                          {data.usdBrl.toLocaleString("pt-BR", {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 6,
                          })}
                        </strong>
                      </>
                    )}
                  </p>
                  {data.rateSource === "frankfurter" && (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      <a
                        href="https://frankfurter.dev/v1/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-400 underline decoration-violet-400/40 underline-offset-2 transition-colors hover:text-violet-300"
                      >
                        Frankfurter
                      </a>{" "}
                      · {data.rateDate} ·{" "}
                      {isCurrentMonth
                        ? "última cotação publicada, atualizada a cada hora"
                        : "referência do último dia útil do mês"}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  data.rateSource === "manual"
                    ? "border-violet-500/25 bg-violet-500/10 text-violet-300"
                    : "border-blue-500/20 bg-blue-500/10 text-blue-300"
                }`}
              >
                {data.rateSource === "manual" ? "Cotação manual" : "Cotação automática"}
              </span>
            </div>

            {data.rateError && (
              <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-amber-300">
                {data.rateError}
                <button className={ghostButton} onClick={() => setRevision((n) => n + 1)}>
                  Tentar novamente
                </button>
              </p>
            )}

            <details className="group mt-3 border-t border-white/5 pt-3">
              <summary className="cursor-pointer list-none text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200">
                <span className="inline-block transition-transform group-open:rotate-90">›</span> Ajustar cotação
                manualmente
              </summary>
              <form
                key={`${month}:${data.usdBrl}`}
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void save({ action: "rate", month, usdBrl: Number(form.get("rate")) });
                }}
              >
                <label className="text-xs text-zinc-400">
                  Cotação de referência do mês: US$ 1 em R$
                  <input
                    required
                    type="number"
                    min="0.000001"
                    max="999"
                    step="0.000001"
                    name="rate"
                    defaultValue={data.usdBrl || ""}
                    className={`ml-2 w-32 tabular-nums ${field}`}
                  />
                </label>
                <button
                  disabled={saving}
                  className="rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/25 disabled:opacity-50"
                >
                  Salvar cotação manual
                </button>
                <p className="w-full text-xs text-zinc-500">
                  Ao salvar, esta cotação fica fixa para o mês e tem prioridade sobre a consulta automática.
                </p>
              </form>
            </details>
          </div>

          <div>
            <SectionTitle
              tone="rose"
              icon={icons.media}
              title="Mídia importada automaticamente"
              hint={`Somente as ${data.monitoredCampaigns} campanhas vinculadas no painel. Não lance esses mesmos gastos como despesas manuais.`}
              total={totalsLabel(mediaTotals)}
            />
            {data.media.length ? (
              <ul className="space-y-1.5">
                {data.media.map((row, index) => {
                  const max = mediaMax[row.currency] || 0;
                  const width = max > 0 ? Math.max(3, (Math.abs(row.spend) / max) * 100) : 0;
                  return (
                    <li
                      key={`${row.campaign}:${row.currency}:${index}`}
                      className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-rose-500/20 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm text-zinc-200">{row.campaign}</span>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-white">
                          {fmt(row.spend, row.currency)}
                        </span>
                      </div>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500/60 to-rose-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-sm text-zinc-500">
                Nenhum gasto de mídia importado neste mês.
              </p>
            )}
          </div>

          <details className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] transition-colors hover:border-violet-500/25">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 text-sm font-medium text-zinc-200">
              <span className="rounded-lg bg-violet-500/10 p-1.5 text-violet-400">{icons.plus}</span>
              Registrar outra despesa
              <span className="ml-auto text-xs text-zinc-500 transition-transform group-open:rotate-90">›</span>
            </summary>
            <form
              className="grid gap-3 border-t border-white/5 p-3.5 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const values = new FormData(form);
                void save(Object.fromEntries(values), form);
              }}
            >
              <label className="text-xs text-zinc-400">
                Descrição
                <input
                  required
                  maxLength={200}
                  name="description"
                  className={`mt-1 block w-full ${field}`}
                  placeholder="Ex.: assinatura de ferramenta"
                />
              </label>
              <label className="text-xs text-zinc-400">
                Data
                <input
                  required
                  type="date"
                  name="date"
                  defaultValue={isCurrentMonth ? toBrazilDateStr() : `${month}-01`}
                  max={toBrazilDateStr()}
                  className={`mt-1 block w-full [color-scheme:dark] ${field}`}
                />
              </label>
              <label className="text-xs text-zinc-400">
                Valor
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  name="amount"
                  className={`mt-1 block w-full tabular-nums ${field}`}
                />
              </label>
              <label className="text-xs text-zinc-400">
                Moeda
                <select name="currency" className={`mt-1 block w-full ${field}`}>
                  <option>BRL</option>
                  <option>USD</option>
                </select>
              </label>
              <label className="text-xs text-zinc-400">
                Categoria
                <select name="category" className={`mt-1 block w-full ${field}`}>
                  {Object.entries(categories).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={saving}
                className="self-end rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:opacity-50"
              >
                {saving ? "Salvando…" : "Salvar despesa"}
              </button>
            </form>
          </details>

          {message && (
            <p
              role="status"
              className={`rounded-lg border px-3 py-2 text-sm ${
                message === "Salvo."
                  ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300"
                  : "border-red-500/20 bg-red-500/[0.06] text-red-300"
              }`}
            >
              {message}
            </p>
          )}

          <div>
            <SectionTitle
              tone="violet"
              icon={icons.receipt}
              title="Despesas manuais"
              total={totalsLabel(manualTotals)}
            />
            {data.expenses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-sm text-zinc-500">
                Nenhuma despesa manual neste mês.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 px-3 py-2.5 transition-colors ${
                      expense.voided_at
                        ? "bg-white/[0.01] opacity-60"
                        : "bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm ${
                          expense.voided_at ? "text-zinc-500 line-through" : "text-zinc-100"
                        }`}
                      >
                        {expense.description}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            categoryStyle[expense.category] ?? categoryStyle.other
                          }`}
                        >
                          {categories[expense.category] ?? expense.category}
                        </span>
                        <span className="text-xs tabular-nums text-zinc-500">{expense.occurred_on}</span>
                        {expense.voided_at && (
                          <span className="inline-flex items-center rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                            Cancelada
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-medium tabular-nums ${
                          expense.voided_at ? "text-zinc-500" : "text-white"
                        }`}
                      >
                        {fmt(expense.amount, expense.currency)}
                      </span>
                      <button
                        disabled={saving}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-violet-300 disabled:opacity-50"
                        onClick={() => void save({ action: expense.voided_at ? "restore" : "void", id: expense.id })}
                      >
                        {expense.voided_at ? "Restaurar" : "Cancelar"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
