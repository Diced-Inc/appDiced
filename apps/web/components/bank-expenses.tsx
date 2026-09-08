"use client";
import { useEffect, useState } from "react";
import { Card } from "@diced/ui/card";
import { toBrazilDateStr } from "@/lib/date";
import type { Expense, MediaSpend } from "@/lib/bank-expenses";

interface Report { grossUsd: number; media: MediaSpend[]; expenses: Expense[]; usdBrl: number | null; totals: Record<string, number>; expensesBrl: number | null; netBrl: number | null; unknown: boolean; mediaIncomplete: boolean; monitoredCampaigns: number }
const fmt = (amount: number | null, currency = "BRL") => amount === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
const field = "rounded border border-white/10 bg-zinc-900 p-2 text-sm text-white";
const categories: Record<string, string> = { software: "Software e assinaturas", services: "Serviços", taxes: "Taxas e impostos", other: "Outros" };

export function BankExpenses() {
  const [month, setMonth] = useState(toBrazilDateStr().slice(0, 7));
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data: Report | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bank/expenses?month=${encodeURIComponent(month)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Despesas indisponíveis.");
      if (!controller.signal.aborted) setState({ data, error: null, loading: false });
    }).catch(error => { if (!controller.signal.aborted) setState({ data: null, error: error.message, loading: false }); });
    return () => controller.abort();
  }, [month, revision]);
  async function save(body: Record<string, unknown>, form?: HTMLFormElement) {
    setSaving(true); setMessage(null);
    try { const response = await fetch("/api/bank/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Falha ao salvar."); if (form && !body.action) form.reset(); setMessage("Salvo."); setRevision(n => n + 1); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }
  const data = state.data;
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Gastos e resultado do mês</h2><p className="mt-1 text-sm text-zinc-400">Receita gerada menos mídia e despesas registradas. Não é o saldo da conta bancária.</p></div><label className="text-sm text-zinc-400">Mês <input aria-label="Mês das despesas" type="month" value={month} max={toBrazilDateStr().slice(0, 7)} className={field} onChange={event => { setMonth(event.target.value); setState({ data: null, error: null, loading: true }); }} /></label></div>
    {state.loading && <p role="status" className="py-4 text-zinc-400">Carregando gastos…</p>}
    {state.error && <p role="alert" className="my-3 text-sm text-amber-300">{state.error}</p>}
    {data && <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded bg-white/5 p-4"><p className="text-xs text-zinc-400">Receita AdMob gerada</p><p className="mt-2 text-xl">{fmt(data.grossUsd, "USD")}</p></div><div className="rounded bg-white/5 p-4"><p className="text-xs text-zinc-400">Gastos totais convertidos</p><p className="mt-2 text-xl">{fmt(data.expensesBrl)}</p></div><div className="rounded bg-white/5 p-4"><p className="text-xs text-zinc-400">Saldo após gastos registrados</p><p className={`mt-2 text-xl ${data.netBrl !== null && data.netBrl < 0 ? "text-red-300" : "text-zinc-100"}`}>{data.mediaIncomplete ? "—" : fmt(data.netBrl)}</p></div></div>
      <p className="text-sm text-zinc-400">Gastos por moeda: {Object.entries(data.totals).map(([currency, amount]) => fmt(amount, currency)).join(" · ") || "Nenhum gasto registrado"}.</p>
      {(data.mediaIncomplete || data.unknown) && <p className="text-sm text-amber-300">{data.mediaIncomplete ? "Há campanhas sem sincronização válida; o resultado está incompleto." : "Há moeda sem conversão configurada; o saldo está indisponível."}</p>}
      <form key={`${month}:${data.usdBrl}`} className="flex flex-wrap items-end gap-2 rounded border border-white/10 p-3" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ action: "rate", month, usdBrl: Number(form.get("rate")) }); }}><label className="text-sm text-zinc-400">Cotação de referência do mês: US$1 em R$<input required type="number" min="0.000001" max="999" step="0.000001" name="rate" defaultValue={data.usdBrl || ""} className={`ml-2 ${field}`} /></label><button disabled={saving} className={field}>Salvar cotação</button><p className="w-full text-xs text-zinc-500">Cotação informada por você para planejamento. Sem cotação, as moedas ficam separadas. Não usamos a cotação de hoje para recalcular meses antigos automaticamente.</p></form>
      <div><h3 className="mb-2 font-medium">Mídia importada automaticamente</h3><p className="mb-2 text-xs text-zinc-400">Somente as {data.monitoredCampaigns} campanhas vinculadas no painel. Não lance esses mesmos gastos como despesas manuais. Campanhas fora do painel não estão incluídas.</p>{data.media.length ? data.media.map((row, index) => <div key={`${row.campaign}:${row.currency}:${index}`} className="flex justify-between gap-3 border-b border-white/5 py-2 text-sm"><span>{row.campaign}</span><span>{fmt(row.spend, row.currency)}</span></div>) : <p className="text-sm text-zinc-500">Nenhum gasto de mídia importado neste mês.</p>}</div>
      <details className="rounded border border-white/10 p-3"><summary className="cursor-pointer font-medium">Registrar outra despesa</summary><form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void save(Object.fromEntries(values), form); }}>
        <label className="text-xs text-zinc-400">Descrição<input required maxLength={200} name="description" className={`mt-1 block w-full ${field}`} placeholder="Ex.: assinatura de ferramenta" /></label>
        <label className="text-xs text-zinc-400">Data<input required type="date" name="date" defaultValue={month === toBrazilDateStr().slice(0, 7) ? toBrazilDateStr() : `${month}-01`} max={toBrazilDateStr()} className={`mt-1 block w-full ${field}`} /></label>
        <label className="text-xs text-zinc-400">Valor<input required type="number" min="0.01" step="0.01" name="amount" className={`mt-1 block w-full ${field}`} /></label>
        <label className="text-xs text-zinc-400">Moeda<select name="currency" className={`mt-1 block w-full ${field}`}><option>BRL</option><option>USD</option></select></label>
        <label className="text-xs text-zinc-400">Categoria<select name="category" className={`mt-1 block w-full ${field}`}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <button disabled={saving} className="self-end rounded bg-violet-600 px-3 py-2 text-sm">Salvar despesa</button>
      </form></details>
      {message && <p role="status" className="text-sm text-violet-300">{message}</p>}
      <div><h3 className="mb-2 font-medium">Despesas manuais</h3>{data.expenses.length === 0 && <p className="text-sm text-zinc-500">Nenhuma despesa manual neste mês.</p>}{data.expenses.map(expense => <div key={expense.id} className={`flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-3 text-sm ${expense.voided_at ? "text-zinc-500" : "text-zinc-200"}`}><div><p>{expense.description}{expense.voided_at ? " · Cancelada" : ""}</p><p className="text-xs text-zinc-500">{expense.occurred_on} · {categories[expense.category]}</p></div><div className="flex items-center gap-3"><span>{fmt(expense.amount, expense.currency)}</span><button disabled={saving} className="text-xs text-violet-400" onClick={() => void save({ action: expense.voided_at ? "restore" : "void", id: expense.id })}>{expense.voided_at ? "Restaurar" : "Cancelar lançamento"}</button></div></div>)}</div>
    </div>}
  </Card>;
}
