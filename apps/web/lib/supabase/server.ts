import { createClient, SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseAdmin: SupabaseClient<any, "public", any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): SupabaseClient<any, "public", any> {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false },
  });

  return supabaseAdmin;
}
