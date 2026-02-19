export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, errorResponse, jsonResponse } from '@/lib/auth/middleware';
import type { DuePeriod, DbPlannerItem } from '@/lib/types/database';

type PlannerBody = {
  title?: string;
  description?: string | null;
  due_date?: string | null; // ISO date
  due_period?: DuePeriod;
  pillar_id?: string | null;
  completed?: boolean;
  sort_order?: number;
};

/**
 * Auto-derive due_date from due_period when due_date is not provided.
 * This makes due_period the source of truth for task scheduling.
 */
function deriveDueDate(duePeriod: DuePeriod, existingDueDate?: string | null): string | null {
  if (existingDueDate) return existingDueDate; // respect explicit dates
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  
  switch (duePeriod) {
    case 'today': {
      return new Date(year, month, date).toISOString().split('T')[0];
    }
    case 'this_week': {
      // Friday of current week (or today if it's already Friday)
      const daysUntilFri = (5 - day + 7) % 7;
      const fri = new Date(year, month, date + daysUntilFri);
      return fri.toISOString().split('T')[0];
    }
    case 'next_week': {
      // Monday of next week (always 7 days ahead if today is Monday, otherwise days until next Monday)
      const daysUntilNextMon = day === 1 ? 7 : (1 - day + 7) % 7;
      const mon = new Date(year, month, date + daysUntilNextMon);
      return mon.toISOString().split('T')[0];
    }
    case 'this_month': {
      const lastDay = new Date(year, month + 1, 0);
      return lastDay.toISOString().split('T')[0];
    }
    case 'this_quarter': {
      const qEnd = new Date(year, Math.ceil((month + 1) / 3) * 3, 0);
      return qEnd.toISOString().split('T')[0];
    }
    default:
      return null;
  }
}

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

// GET /api/planner -> list tasks for active business
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  try {
    const ctx = await getUserBusiness(auth.context.outsetaUid);
    if (!ctx) return jsonResponse({ planner: [] });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('planner')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('completed', { ascending: true })
      .order('due_period', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return jsonResponse({ planner: (data ?? []) as DbPlannerItem[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('planner GET error:', message);
    return errorResponse('Failed to fetch planner', 500, 'DATABASE_ERROR');
  }
}

// POST /api/planner -> create task
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  let body: PlannerBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, 'INVALID_BODY');
  }

  if (!body.title || typeof body.title !== 'string') {
    return errorResponse('Missing required field: title', 400, 'MISSING_FIELDS');
  }

  const due_period: DuePeriod = (body.due_period as DuePeriod) ?? 'today';
  const derivedDueDate = deriveDueDate(due_period, body.due_date);

  try {
    const ctx = await getOrCreateUserAndBusiness(
      auth.context.outsetaUid,
      auth.context.email,
      auth.context.accountUid,
    );

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('planner')
      .insert({
        business_id: ctx.businessId,
        title: body.title,
        description: body.description ?? null,
        due_date: derivedDueDate,
        due_period,
        pillar_id: body.pillar_id ?? null,
        completed: body.completed ?? false,
        sort_order: body.sort_order ?? 0,
        source_workflow: null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return jsonResponse({ planner: data as DbPlannerItem }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('planner POST error:', message);
    return errorResponse('Failed to create planner item', 500, 'DATABASE_ERROR');
  }
}

// PATCH /api/planner -> update/toggle
export async function PATCH(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  let body: PlannerBody & { id?: string };
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
  if (body.pillar_id !== undefined) updates.pillar_id = body.pillar_id;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
  
  // Handle due_period and due_date together
  if (body.due_period !== undefined) {
    updates.due_period = body.due_period;
    // Auto-derive due_date from due_period if due_date is not explicitly provided
    if (body.due_date === undefined) {
      updates.due_date = deriveDueDate(body.due_period, null);
    }
  }
  if (body.due_date !== undefined) {
    updates.due_date = body.due_date;
  }
  
  if (body.completed !== undefined) {
    updates.completed = body.completed;
    updates.completed_at = body.completed ? new Date().toISOString() : null;
  }

  try {
    const ctx = await getUserBusiness(auth.context.outsetaUid);
    if (!ctx) return errorResponse('No business found for user', 404, 'NOT_FOUND');

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('planner')
      .update(updates)
      .eq('id', body.id)
      .eq('business_id', ctx.businessId)
      .select('*')
      .single();

    if (error) throw error;
    return jsonResponse({ planner: data as DbPlannerItem });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('planner PATCH error:', message);
    return errorResponse('Failed to update planner item', 500, 'DATABASE_ERROR');
  }
}
