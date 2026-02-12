export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, errorResponse, jsonResponse } from '@/lib/auth/middleware';
import type { DbGoal, GoalStatus, TimeHorizon } from '@/lib/types/database';

type GoalBody = {
  title?: string;
  description?: string | null;
  time_horizon?: TimeHorizon;
  pillar_id?: string | null;
  status?: GoalStatus;
  sort_order?: number;
};

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
  let { data: user, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('outseta_uid', outsetaUid)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!user) {
    const { data: insertedUser, error } = await supabase
      .from('users')
      .insert({ outseta_uid: outsetaUid, email: email ?? null, account_uid: accountUid ?? null })
      .select('id')
      .single();
    if (error) throw error;
    user = insertedUser;
  }

  let { data: biz, error: bizErr } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .maybeSingle();
  if (bizErr) throw bizErr;
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

// GET /api/goals -> list goals for active business
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  try {
    const ctx = await getUserBusiness(auth.context.outsetaUid);
    if (!ctx) return jsonResponse({ goals: [] });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('time_horizon', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return jsonResponse({ goals: (data ?? []) as DbGoal[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('goals GET error:', message);
    return errorResponse('Failed to fetch goals', 500, 'DATABASE_ERROR');
  }
}

// POST /api/goals -> create goal
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  let body: GoalBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, 'INVALID_BODY');
  }

  if (!body.title || typeof body.title !== 'string') {
    return errorResponse('Missing required field: title', 400, 'MISSING_FIELDS');
  }

  const time_horizon: TimeHorizon = (body.time_horizon as TimeHorizon) ?? 'this_week';
  const status: GoalStatus = (body.status as GoalStatus) ?? 'active';

  try {
    const ctx = await getOrCreateUserAndBusiness(
      auth.context.outsetaUid,
      auth.context.email,
      auth.context.accountUid,
    );

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('goals')
      .insert({
        business_id: ctx.businessId,
        title: body.title,
        description: body.description ?? null,
        time_horizon,
        pillar_id: body.pillar_id ?? null,
        status,
        sort_order: body.sort_order ?? 0,
        source_workflow: null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return jsonResponse({ goal: data as DbGoal }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('goals POST error:', message);
    return errorResponse('Failed to create goal', 500, 'DATABASE_ERROR');
  }
}

// PATCH /api/goals -> update goal (e.g., status, title)
export async function PATCH(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  let body: GoalBody & { id?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, 'INVALID_BODY');
  }

  if (!body.id || typeof body.id !== 'string') {
    return errorResponse('Missing required field: id', 400, 'MISSING_FIELDS');
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.time_horizon !== undefined) updates.time_horizon = body.time_horizon;
  if (body.pillar_id !== undefined) updates.pillar_id = body.pillar_id;
  if (body.status !== undefined) updates.status = body.status;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
  if (body.status === 'achieved') updates.achieved_at = new Date().toISOString();
  if (body.status && body.status !== 'achieved') updates.achieved_at = null;

  try {
    const ctx = await getUserBusiness(auth.context.outsetaUid);
    if (!ctx) return errorResponse('No business found for user', 404, 'NOT_FOUND');

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', body.id)
      .eq('business_id', ctx.businessId)
      .select('*')
      .single();

    if (error) throw error;
    return jsonResponse({ goal: data as DbGoal });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('goals PATCH error:', message);
    return errorResponse('Failed to update goal', 500, 'DATABASE_ERROR');
  }
}
