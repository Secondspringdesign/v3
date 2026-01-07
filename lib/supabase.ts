/**
 * Supabase client singleton for Edge runtime
 *
 * Uses service role key for server-side API routes.
 * Never expose this client or credentials to the browser.
 *
 * Required env vars:
 *   SUPABASE_URL - Project URL (e.g., https://xxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY - Service role secret key (sb_secret_... format preferred)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Validates required environment variables
 * @throws Error if variables are missing
 */
function validateEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing SUPABASE_URL environment variable');
  }

  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return { url, key };
}

/**
 * Returns singleton Supabase client configured with service role key
 *
 * The client uses the service role key which bypasses RLS.
 * Access control is enforced at the application layer.
 *
 * @returns Supabase client instance
 * @throws Error if environment variables are missing
 */
export function getSupabaseClient(): SupabaseClient {
  // Guard: Services should return early in stub mode before calling this
  if (process.env.SUPABASE_STUB_MODE === 'true') {
    throw new Error(
      'getSupabaseClient called in stub mode - services should have returned early'
    );
  }

  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, key } = validateEnv();

  supabaseClient = createClient(url, key, {
    auth: {
      // Disable auth features since we use Outseta for identity
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}

/**
 * Type helper for database operations
 * Add generated types here when using Supabase CLI:
 *   npx supabase gen types typescript --project-id <id> > lib/types/supabase.ts
 */
export type { SupabaseClient };
