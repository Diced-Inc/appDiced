/**
 * appdiced-cron — dispara o sync horário do dashboard.
 * O trabalho pesado roda na Vercel; isto aqui é só o gatilho autenticado.
 * Secret necessária: CRON_SECRET (mesma da Vercel) — `wrangler secret put CRON_SECRET`
 */

const SYNC_URL = "https://app.diced.com.br/api/cron/sync?mode=hourly";

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(trigger(env));
  },

  // Só pra conferir que o worker está vivo (não dispara sync sem auth)
  async fetch() {
    return new Response("appdiced-cron ok", { status: 200 });
  },
};

async function trigger(env) {
  if (!env.CRON_SECRET) {
    console.error("CRON_SECRET não configurada — rode: wrangler secret put CRON_SECRET");
    return;
  }

  try {
    const res = await fetch(SYNC_URL, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`sync falhou: HTTP ${res.status} — ${body.slice(0, 500)}`);
      return;
    }
    console.log(`sync ok: ${body.slice(0, 500)}`);
  } catch (err) {
    console.error(`sync erro de rede: ${err instanceof Error ? err.message : String(err)}`);
  }
}
