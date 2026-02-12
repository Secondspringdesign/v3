export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, errorResponse, jsonResponse } from '@/lib/auth/middleware';
import type { DbDocument } from '@/lib/types/database';

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
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('outseta_uid', outsetaUid)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!user) return null;

  const { data: biz, error: bizErr } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .maybeSingle();
  if (bizErr) throw bizErr;
  if (!biz) return null;

  return { userId: user.id, businessId: biz.id };
}

// GET /api/documents -> list documents/files for active business
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  try {
    const ctx = await getUserBusiness(auth.context.outsetaUid);
    if (!ctx) return jsonResponse({ documents: [] });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('documents')
      .select('id, document_type, title, content, version, updated_at, created_at')
      .eq('business_id', ctx.businessId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return jsonResponse({ documents: (data ?? []) as DbDocument[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('documents GET error:', message);
    return errorResponse('Failed to fetch documents', 500, 'DATABASE_ERROR');
  }
}
