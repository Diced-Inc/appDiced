export interface Expense { id: string; occurred_on: string; description: string; category: string; amount: number; currency: "BRL" | "USD"; voided_at: string | null }
export interface MediaSpend { campaign: string; currency: string; spend: number }
export function monthlyBalance(grossUsd: number, media: MediaSpend[], expenses: Expense[], rate: number | null) {
  const totals: Record<string, number> = {};
  for (const row of media) totals[row.currency] = (totals[row.currency] || 0) + row.spend;
  for (const row of expenses.filter(e => !e.voided_at)) totals[row.currency] = (totals[row.currency] || 0) + Number(row.amount);
  const unknown = Object.keys(totals).some(c => c !== "BRL" && c !== "USD" && totals[c] !== 0);
  const usable = rate !== null && Number.isFinite(rate) && rate > 0 && !unknown;
  const expensesBrl = usable ? (totals.BRL || 0) + (totals.USD || 0) * rate : null;
  return { totals, expensesBrl, netBrl: expensesBrl !== null ? grossUsd * rate! - expensesBrl : null, unknown };
}
export function expenseInput(body: Record<string, unknown> | null) {
  const date = body?.date; const amount = Number(body?.amount); const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !Number.isFinite(amount) || amount <= 0 || amount > 999999999 || !description || description.length > 200 || !["BRL", "USD"].includes(String(body?.currency)) || !["software", "services", "taxes", "other"].includes(String(body?.category))) return null;
  return { occurred_on: date, amount: Math.round(amount * 100) / 100, description, currency: String(body!.currency), category: String(body!.category) };
}
