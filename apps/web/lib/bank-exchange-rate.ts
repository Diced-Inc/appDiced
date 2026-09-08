export interface BankExchangeRate { usdBrl: number | null; rateSource: "manual" | "frankfurter" | null; rateDate: string | null; rateError: string | null }

export async function bankExchangeRate(month: string, today: string, manual: number | null): Promise<BankExchangeRate> {
  if (manual !== null && Number.isFinite(manual) && manual > 0) return { usdBrl: manual, rateSource: "manual", rateDate: null, rateError: null };
  try {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > today.slice(0, 7)) throw new Error("Invalid month");
    const end = new Date(`${month}-01T12:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const target = month === today.slice(0, 7) ? today : end.toISOString().slice(0, 10);
    const response = await fetch(`https://api.frankfurter.dev/v1/${target}?base=USD&symbols=BRL`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Rate service unavailable");
    const data = await response.json();
    const value = data?.rates?.BRL;
    const age = (Date.parse(target) - Date.parse(data?.date)) / 86400000;
    if (data?.base !== "USD" || data?.amount !== 1 || typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 1000 || !/^\d{4}-\d{2}-\d{2}$/.test(data?.date) || !Number.isFinite(age) || age < 0 || age > 10) throw new Error("Invalid rate");
    return { usdBrl: value, rateSource: "frankfurter", rateDate: data.date, rateError: null };
  } catch {
    return { usdBrl: null, rateSource: null, rateDate: null, rateError: "Não foi possível consultar a cotação automática. Tente novamente ou informe uma cotação manual." };
  }
}
