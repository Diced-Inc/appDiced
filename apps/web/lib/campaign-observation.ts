export function observationSummary(snapshot: Record<string, unknown>, currency: string): string[] {
  const campaign = (snapshot.campaign || {}) as Record<string, unknown>;
  const status: Record<string, string> = { ACTIVE: "ativa", PAUSED: "pausada", PENDING_REVIEW: "em análise", IN_PROCESS: "em processamento", DISAPPROVED: "reprovada" };
  const lines = [`Campanha ${status[String(campaign.status)] || String(campaign.status || "sem status")}.`];
  const daily = Number(campaign.daily_budget); const lifetime = Number(campaign.lifetime_budget);
  if (["BRL", "USD", "EUR", "GBP"].includes(currency) && (daily > 0 || lifetime > 0)) lines.push(`Orçamento ${daily > 0 ? "diário" : "total"}: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format((daily > 0 ? daily : lifetime) / 100)}.`);
  const ads = Array.isArray(snapshot.ads) ? snapshot.ads as { name?: string; status?: string; id?: string }[] : [];
  lines.push(...ads.map(ad => `${ad.name || "Anúncio"}: ${status[ad.status || ""] || ad.status || "sem status"}.`));
  return lines;
}

export function observationChanges(before: Record<string, unknown> | null, after: Record<string, unknown>): string[] {
  if (!before) return ["Primeira configuração registrada."];
  const a = (before.campaign || {}) as Record<string, unknown>; const b = (after.campaign || {}) as Record<string, unknown>;
  const changes: string[] = [];
  if (a.status !== b.status) changes.push("Status da campanha alterado.");
  if (a.daily_budget !== b.daily_budget || a.lifetime_budget !== b.lifetime_budget) changes.push("Orçamento alterado.");
  if (a.name !== b.name) changes.push("Nome da campanha alterado.");
  type Ad = { id: string; name?: string; status?: string; creativeId?: string };
  const old = new Map((Array.isArray(before.ads) ? before.ads as Ad[] : []).map(ad => [ad.id, ad]));
  const current = Array.isArray(after.ads) ? after.ads as Ad[] : [];
  for (const ad of current) { const previous = old.get(ad.id); if (!previous) changes.push(`Anúncio adicionado: ${ad.name || ad.id}.`); else { if (previous.creativeId !== ad.creativeId) changes.push(`Criativo substituído: ${ad.name || ad.id}.`); if (previous.status !== ad.status) changes.push(`Status do anúncio alterado: ${ad.name || ad.id}.`); } }
  for (const ad of old.values()) if (!current.some(item => item.id === ad.id)) changes.push(`Anúncio não retornou na consulta: ${ad.name || ad.id}.`);
  return changes.length ? changes : ["Atualização de configuração observada."];
}
