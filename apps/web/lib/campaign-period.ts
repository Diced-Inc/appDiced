import { toBrazilDateStr } from "@/lib/date";
import { isPeriodKey, resolvePeriod, PERIOD_LABELS, type DateRange } from "@/lib/period";

export const CAMPAIGN_PERIODS = { today: "Hoje", yesterday: "Ontem", "7d": "Últimos 7 dias", month: "Este mês", custom: "Personalizado" };

function validDate(value?: string): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function campaignPeriod(params: { period?: string; from?: string; to?: string }, today = toBrazilDateStr()): { range: DateRange; label: string; error?: string } {
  const day = (offset: number) => new Date(Date.parse(`${today}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
  if (params.period === "custom") {
    if (validDate(params.from) && validDate(params.to) && params.from <= params.to && params.to <= today) {
      return { range: { from: params.from, to: params.to }, label: `${params.from.split("-").reverse().join("/")} a ${params.to.split("-").reverse().join("/")}` };
    }
    return { range: { from: day(-6), to: today }, label: "Últimos 7 dias", error: "Escolha datas válidas, em ordem, até hoje. Exibindo os últimos 7 dias." };
  }
  if (params.period === "today") return { range: { from: today, to: today }, label: "Hoje" };
  if (params.period === "yesterday") return { range: { from: day(-1), to: day(-1) }, label: "Ontem" };
  if (isPeriodKey(params.period)) return { range: resolvePeriod(params.period, today), label: PERIOD_LABELS[params.period] };
  return { range: { from: day(-6), to: today }, label: "Últimos 7 dias" };
}
