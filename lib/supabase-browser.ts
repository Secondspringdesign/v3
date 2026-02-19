/**
 * Supabase client for browser runtime (Realtime + client reads)
 *
 * Uses anon key and NEXT_PUBLIC_SUPABASE_URL.
 * Safe for client-side use.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function validateEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
  }

  return { url, key };
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, key } = validateEnv();

  browserClient = createClient(url, key, {
    auth: {
      // We use Outseta for identity; Supabase auth is not used
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return browserClient;
}

export type { SupabaseClient };
