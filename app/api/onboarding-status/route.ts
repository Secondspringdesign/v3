export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, jsonResponse } from '@/lib/auth/middleware';

function requireEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return { url, key };
}

function supabaseAdmin() {
  const { url, key } = requireEnv();
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getOnboardingStatus(outsetaUid: string): Promise<boolean> {
  const supabase = supabaseAdmin();
  
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('outseta_uid', outsetaUid)
    .maybeSingle();
  
  if (userErr) throw userErr;
  if (!userRow) return false;

  const { data: bizRow, error: bizErr } = await supabase
    .from('businesses')
    .select('onboarding_complete')
    .eq('user_id', userRow.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .maybeSingle();
  
  if (bizErr) throw bizErr;
  if (!bizRow) return false;

  return bizRow.onboarding_complete ?? false;
}

// GET /api/onboarding-status -> fast check for onboarding completion
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    // Return false for unauthorized users (used by Framer redirect)
    return jsonResponse({ onboarding_complete: false });
  }

  try {
    const onboardingComplete = await getOnboardingStatus(auth.context.outsetaUid);
    return jsonResponse({ onboarding_complete: onboardingComplete });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('onboarding-status GET error:', message);
    // Return false on error to avoid blocking access
    return jsonResponse({ onboarding_complete: false });
  }
}
