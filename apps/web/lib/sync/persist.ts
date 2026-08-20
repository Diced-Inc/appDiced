import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, "public", any>;

const CHUNK_SIZE = 500;
const PAGE_SIZE = 1000;

/** Upsert em lotes de 500 — substitui os inserts linha a linha do sync antigo. */
export async function chunkedUpsert(
  supabase: AnyClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`Upsert em ${table} falhou: ${error.message}`);
  }
}

/**
 * Busca todas as linhas paginando em blocos de 1000 (limite padrão do PostgREST).
 * `apply` recebe o query builder já com select() pra encadear filtros/order.
 */
export async function fetchAll<T>(
  supabase: AnyClient,
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply?: (q: any) => any
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; ; page++) {
    let q = supabase.from(table).select(select);
    if (apply) q = apply(q);
    const { data, error } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw new Error(`Fetch em ${table} falhou: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}
