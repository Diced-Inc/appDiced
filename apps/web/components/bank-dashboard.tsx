"use client";

import { useState, useCallback, useEffect } from "react";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { Badge } from "@diced/ui/badge";
import type { BankData } from "@/lib/data";
import type { MonthlyEarning } from "@/lib/types";

const ADMOB_THRESHOLD = 100;

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthLabel(month: string) {
  const s = new Date(`${month}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dateLabel(dateStr: string) {
  return new Date(`${dateStr.substring(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

const statusBadge: Record<MonthlyEarning["status"], { variant: "success" | "warning" | "info"; label: string }> = {
  open: { variant: "info", label: "Em andamento" },
  closed: { variant: "warning", label: "Fechado" },
  paid: { variant: "success", label: "Pago" },
};

const iconProps = {
  className: "h-5 w-5",
  fill: "none" as const,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.5,
} as const;

const icons = {
  receivable: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  current: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  received: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
};

export function BankDashboard({ initial }: { initial: BankData }) {
  const [data, setData] = useState<BankData>(initial);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyMonth, setBusyMonth] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", date: new Date().toISOString().split("T")[0], note: "" });
  const [usdBrl, setUsdBrl] = useState<number | null>(null);

  useEffect(() => {
    fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL")
      .then((r) => r.json())
      .then((d) => {
        const rate = Number(d?.USDBRL?.bid);
        if (rate > 0) setUsdBrl(rate);
      })
      .catch(() => {});
  }, []);

  const brl = (usd: number) => (usdBrl ? fmtBRL(usd * usdBrl) : undefined);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/bank");
    if (res.ok) setData(await res.json());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(form.amount), date: form.date, note: form.note || null }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ amount: "", date: new Date().toISOString().split("T")[0], note: "" });
        await refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/bank/${id}`, { method: "DELETE" });
    if (res.ok) await refresh();
  };

  const togglePaid = async (month: MonthlyEarning) => {
    setBusyMonth(month.month);
    try {
      const res = await fetch("/api/bank/monthly", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: month.month, paid: month.status !== "paid" }),
      });
      if (res.ok) await refresh();
    } finally {
      setBusyMonth(null);
    }
  };

  const { receivable, receivedLifetime, currentMonth, months, withdrawals } = data;
  const thresholdMissing = Math.max(0, ADMOB_THRESHOLD - receivable);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        <KpiCard
          title="A Receber (meses fechados)"
          value={fmt(receivable)}
          change={brl(receivable)}
          changeType={receivable > 0 ? "positive" : "neutral"}
          icon={icons.receivable}
        />
        <KpiCard
          title={`${monthLabel(currentMonth.month)} (parcial)`}
          value={fmt(currentMonth.gross)}
          subtitle={brl(currentMonth.gross)}
          change={`projeção ${fmt(currentMonth.projection)} no fim do mês`}
          changeType="neutral"
          icon={icons.current}
        />
        <KpiCard
          title="Recebido (lifetime)"
          value={fmt(receivedLifetime)}
          change={brl(receivedLifetime)}
          changeType="neutral"
          icon={icons.received}
        />
      </div>

      {/* Threshold */}
      {receivable > 0 && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            thresholdMissing > 0
              ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
          }`}
        >
          {thresholdMissing > 0
            ? `Faltam ${fmt(thresholdMissing)} pro threshold de ${fmt(ADMOB_THRESHOLD)} do AdMob — o pagamento só sai quando o saldo fechado atinge o limite.`
            : `Threshold de ${fmt(ADMOB_THRESHOLD)} atingido — pagamento previsto por volta do dia 21.`}
        </div>
      )}

      {/* Extrato mensal */}
      <Card>
        <h2 className="mb-3 text-base font-semibold font-heading md:mb-4 md:text-lg">
          Extrato Mensal
        </h2>
        {months.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem dados ainda. Sincronize o AdMob.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/5 text-zinc-400">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Mês</th>
                  <th className="pb-3 pr-4 text-right font-medium">Receita</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium hidden sm:table-cell">Pagamento</th>
                  <th className="pb-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {months.map((m) => {
                  const badge = statusBadge[m.status];
                  return (
                    <tr key={m.month}>
                      <td className="py-2.5 pr-4 text-white">{monthLabel(m.month)}</td>
                      <td className="py-2.5 pr-4 text-right font-medium text-white">
                        {fmt(m.gross)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-400 hidden sm:table-cell">
                        {m.status === "paid" && m.paidAt
                          ? `pago em ${dateLabel(m.paidAt)}${m.paidAmount !== null ? ` · ${fmt(m.paidAmount)}` : ""}`
                          : m.status === "closed"
                            ? `previsto ~${dateLabel(m.estimatedPayment)}`
                            : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        {m.status !== "open" && (
                          <button
                            onClick={() => togglePaid(m)}
                            disabled={busyMonth === m.month}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                              m.status === "paid"
                                ? "text-zinc-500 hover:text-zinc-300"
                                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                          >
                            {busyMonth === m.month
                              ? "..."
                              : m.status === "paid"
                                ? "Desfazer"
                                : "Marcar pago"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recebimentos */}
      <Card>
        <div className="mb-3 flex items-center justify-between md:mb-4">
          <h2 className="text-base font-semibold font-heading md:text-lg">Recebimentos</h2>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-400 transition-colors hover:bg-violet-500/20"
          >
            + Registrar
          </button>
        </div>

        {withdrawals.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nenhum recebimento registrado. Marque um mês como pago ou registre manualmente.
          </p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-white">{fmt(w.amount)}</p>
                  <p className="text-xs text-zinc-500">
                    {dateLabel(w.date)}
                    {w.note ? ` · ${w.note}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="text-xs text-zinc-500 transition-colors hover:text-red-400"
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal registrar recebimento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-2 p-5">
            <h3 className="mb-4 text-lg font-semibold font-heading">Registrar recebimento</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Valor (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Data</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Observação</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-violet-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
