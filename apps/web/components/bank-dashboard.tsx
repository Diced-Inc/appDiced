"use client";

import { useState, useCallback, useEffect } from "react";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";

interface Withdrawal {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

interface BankData {
  balance: number;
  totalRevenue: number;
  totalWithdrawn: number;
  withdrawals: Withdrawal[];
}

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const iconProps = {
  className: "h-5 w-5",
  fill: "none" as const,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.5,
} as const;

const icons = {
  balance: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  revenue: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  withdrawn: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
};

export function BankDashboard({ initial }: { initial: BankData }) {
  const [data, setData] = useState<BankData>(initial);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const brl = (usd: number) => usdBrl ? fmtBRL(usd * usdBrl) : undefined;

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

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        <KpiCard
          title="Saldo Disponivel"
          value={fmt(data.balance)}
          change={brl(data.balance)}
          changeType={data.balance > 0 ? "positive" : "neutral"}
          icon={icons.balance}
        />
        <KpiCard
          title="Receita Total (lifetime)"
          value={fmt(data.totalRevenue)}
          change={brl(data.totalRevenue)}
          changeType="neutral"
          icon={icons.revenue}
        />
        <KpiCard
          title="Total Sacado"
          value={fmt(data.totalWithdrawn)}
          change={brl(data.totalWithdrawn)}
          changeType={data.totalWithdrawn > 0 ? "negative" : "neutral"}
          icon={icons.withdrawn}
        />
      </div>

      {/* Withdrawals History */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold font-heading">Historico de Saques</h2>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            Registrar Saque
          </button>
        </div>

        {data.withdrawals.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            Nenhum saque registrado. Clique em &quot;Registrar Saque&quot; para adicionar.
          </p>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-zinc-400">
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Valor</th>
                  <th className="pb-3 font-medium">Nota</th>
                  <th className="pb-3 text-right font-medium">Acao</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 text-zinc-300">
                      {new Date(w.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3">
                      <span className="font-medium text-red-400">-{fmt(Number(w.amount))}</span>
                      {usdBrl && (
                        <span className="ml-2 text-xs text-zinc-500">
                          {fmtBRL(Number(w.amount) * usdBrl)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-zinc-400">
                      {w.note || "—"}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Remover saque"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-2 p-6">
            <h3 className="mb-4 text-lg font-semibold font-heading">Registrar Saque</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Valor (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Data</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Nota (opcional)</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-violet-500"
                  placeholder="Ex: Pagamento AdMob marco"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
