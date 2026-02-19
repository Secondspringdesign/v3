export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, errorResponse, jsonResponse } from '@/lib/auth/middleware';

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

async function getUserBusiness(outsetaUid: string) {
  const supabase = supabaseAdmin();
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('outseta_uid', outsetaUid)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!userRow) return null;

  const { data: bizRow, error: bizErr } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', userRow.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .maybeSingle();
  if (bizErr) throw bizErr;
  if (!bizRow) return null;

  return { userId: userRow.id, businessId: bizRow.id };
}

// GET /api/documents -> list documents for active business
// NOTE: The 'documents' table must be created in Supabase first.
// See docs/supabase-setup.md for the required schema and setup instructions.
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  try {
    const ctx = await getUserBusiness(auth.context.outsetaUid);
    if (!ctx) return jsonResponse({ documents: [] });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('documents GET error:', error.message ?? error);
      return jsonResponse(
        { documents: [], error: 'Failed to fetch documents', code: 'DATABASE_ERROR' },
        200,
      );
    }

    return jsonResponse({ documents: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('documents GET error:', message);
    return jsonResponse(
      { documents: [], error: 'Failed to fetch documents', code: 'DATABASE_ERROR' },
      200,
    );
  }
}
