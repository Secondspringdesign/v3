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

async function getOrCreateUserAndBusiness(outsetaUid: string, email?: string | null, accountUid?: string | null) {
  const supabase = supabaseAdmin();

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('outseta_uid', outsetaUid)
    .maybeSingle();
  if (userErr) throw userErr;
  let user = userRow;

  if (!user) {
    const { data: insertedUser, error } = await supabase
      .from('users')
      .insert({
        outseta_uid: outsetaUid,
        email: email ?? null,
        account_uid: accountUid ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    user = insertedUser;
  }

  const { data: bizRow, error: bizErr } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .maybeSingle();
  if (bizErr) throw bizErr;
  let biz = bizRow;

  if (!biz) {
    const { data: insertedBiz, error } = await supabase
      .from('businesses')
      .insert({ user_id: user.id, status: 'active', name: 'My Business' })
      .select('id')
      .single();
    if (error) throw error;
    biz = insertedBiz;
  }

  return { userId: user.id, businessId: biz.id };
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

// POST /api/documents -> create or update document (upsert)
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  let body: { document_type?: string; title?: string; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, 'INVALID_BODY');
  }

  if (!body.document_type || typeof body.document_type !== 'string') {
    return errorResponse('Missing required field: document_type', 400, 'MISSING_FIELDS');
  }

  try {
    const ctx = await getOrCreateUserAndBusiness(
      auth.context.outsetaUid,
      auth.context.email,
      auth.context.accountUid,
    );

    const supabase = supabaseAdmin();

    // Check if document already exists (upsert behavior)
    const { data: existing, error: existingErr } = await supabase
      .from('documents')
      .select('id, version')
      .eq('business_id', ctx.businessId)
      .eq('document_type', body.document_type)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existing) {
      // Update existing document
      const updates: Record<string, unknown> = {
        version: existing.version + 1,
      };
      if (body.title !== undefined) updates.title = body.title;
      if (body.content !== undefined) updates.content = body.content;

      const { data, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      return jsonResponse({ document: data }, 200);
    } else {
      // Insert new document
      const { data, error } = await supabase
        .from('documents')
        .insert({
          business_id: ctx.businessId,
          document_type: body.document_type,
          title: body.title ?? null,
          content: body.content ?? null,
          version: 1,
        })
        .select('*')
        .single();

      if (error) throw error;
      return jsonResponse({ document: data }, 201);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('documents POST error:', message);
    return errorResponse('Failed to save document', 500, 'DATABASE_ERROR');
  }
}

// PATCH /api/documents -> update existing document
export async function PATCH(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  let body: { id?: string; title?: string; content?: unknown; document_type?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, 'INVALID_BODY');
  }

  if (!body.id || typeof body.id !== 'string') {
    return errorResponse('Missing required field: id', 400, 'MISSING_FIELDS');
  }

  try {
    const ctx = await getUserBusiness(auth.context.outsetaUid);
    if (!ctx) return errorResponse('No business found for user', 404, 'NOT_FOUND');

    const supabase = supabaseAdmin();

    // Fetch current version for increment
    const { data: current, error: fetchErr } = await supabase
      .from('documents')
      .select('version')
      .eq('id', body.id)
      .eq('business_id', ctx.businessId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!current) return errorResponse('Document not found', 404, 'NOT_FOUND');

    const updates: Record<string, unknown> = {
      version: current.version + 1,
    };
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.document_type !== undefined) updates.document_type = body.document_type;

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', body.id)
      .eq('business_id', ctx.businessId)
      .select('*')
      .single();

    if (error) throw error;
    return jsonResponse({ document: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('documents PATCH error:', message);
    return errorResponse('Failed to update document', 500, 'DATABASE_ERROR');
  }
}
