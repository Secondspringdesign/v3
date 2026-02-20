export const runtime = 'edge';

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, errorResponse, jsonResponse } from '@/lib/auth/middleware';

type Milestone = {
  id: string;
  label: string;
  done: boolean;
  weight: number;
};

type OnboardingProgress = {
  percent: number;
  complete: boolean;
  milestones: Milestone[];
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
    .select('id, onboarding_complete')
    .eq('user_id', userRow.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .maybeSingle();
  if (bizErr) throw bizErr;
  if (!bizRow) return null;

  return { userId: userRow.id, businessId: bizRow.id, onboardingComplete: bizRow.onboarding_complete };
}

async function calculateProgress(businessId: string): Promise<OnboardingProgress> {
  const supabase = supabaseAdmin();

  // Fetch all facts for the business
  const { data: facts, error: factsErr } = await supabase
    .from('facts')
    .select('fact_id, fact_type_id')
    .eq('business_id', businessId);
  
  if (factsErr) throw factsErr;

  // Count planner items
  const { count: plannerCount, error: plannerErr } = await supabase
    .from('planner')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
  
  if (plannerErr) throw plannerErr;

  // Count lite_business_plan documents
  const { count: planDocCount, error: planDocErr } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('document_type', 'lite_business_plan');
  
  if (planDocErr) throw planDocErr;

  // Calculate milestones
  const factsList = facts ?? [];
  
  // Named it - business_name fact exists
  const hasBusinessName = factsList.some(
    f => f.fact_type_id === 'business_name' || f.fact_id === 'business_name'
  );

  // Knows the problem - core_problem fact exists
  const hasCoreProblem = factsList.some(
    f => f.fact_type_id === 'core_problem' || f.fact_id === 'core_problem'
  );

  // Found their person - target_customer fact exists
  const hasTargetCustomer = factsList.some(
    f => f.fact_type_id === 'target_customer' || f.fact_id === 'target_customer'
  );

  // Described the offer - offer_summary fact exists
  const hasOfferSummary = factsList.some(
    f => f.fact_type_id === 'offer_summary' || f.fact_id === 'offer_summary'
  );

  // First step set - at least 1 planner item
  const hasFirstPlannerItem = (plannerCount ?? 0) >= 1;

  // Plan in hand - lite_business_plan document exists
  const hasLiteBusinessPlan = (planDocCount ?? 0) >= 1;

  // Overall completion
  const onboardingDone = hasBusinessName && hasCoreProblem && hasTargetCustomer && 
                          hasOfferSummary && hasFirstPlannerItem && hasLiteBusinessPlan;

  const milestones: Milestone[] = [
    { id: 'named_it', label: 'Named your business', done: hasBusinessName, weight: 15 },
    { id: 'knows_the_problem', label: 'Defined the problem', done: hasCoreProblem, weight: 20 },
    { id: 'found_their_person', label: 'Found your person', done: hasTargetCustomer, weight: 20 },
    { id: 'described_the_offer', label: 'Described your offer', done: hasOfferSummary, weight: 15 },
    { id: 'first_step_set', label: 'Set your first step', done: hasFirstPlannerItem, weight: 15 },
    { id: 'plan_in_hand', label: 'Plan in hand', done: hasLiteBusinessPlan, weight: 15 },
  ];

  // Calculate percentage
  const percent = milestones.reduce((sum, m) => sum + (m.done ? m.weight : 0), 0);

  return {
    percent,
    complete: onboardingDone,
    milestones,
  };
}

// GET /api/onboarding-progress -> return onboarding progress
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  try {
    const ctx = await getUserBusiness(auth.context.outsetaUid);
    if (!ctx) {
      // No business found - return empty progress
      const emptyProgress: OnboardingProgress = {
        percent: 0,
        complete: false,
        milestones: [
          { id: 'named_it', label: 'Named your business', done: false, weight: 15 },
          { id: 'knows_the_problem', label: 'Defined the problem', done: false, weight: 20 },
          { id: 'found_their_person', label: 'Found your person', done: false, weight: 20 },
          { id: 'described_the_offer', label: 'Described your offer', done: false, weight: 15 },
          { id: 'first_step_set', label: 'Set your first step', done: false, weight: 15 },
          { id: 'plan_in_hand', label: 'Plan in hand', done: false, weight: 15 },
        ],
      };
      return jsonResponse(emptyProgress);
    }

    const progress = await calculateProgress(ctx.businessId);

    // Auto-update onboarding_complete if all milestones are done and not already set
    if (progress.complete && !ctx.onboardingComplete) {
      const supabase = supabaseAdmin();
      await supabase
        .from('businesses')
        .update({ onboarding_complete: true })
        .eq('id', ctx.businessId);
    }

    return jsonResponse(progress);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('onboarding-progress GET error:', message);
    return errorResponse('Failed to fetch onboarding progress', 500, 'DATABASE_ERROR');
  }
}

// POST /api/onboarding-progress -> manually mark onboarding complete
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth.success) return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');

  let body: { complete?: boolean };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, 'INVALID_BODY');
  }

  if (typeof body.complete !== 'boolean') {
    return errorResponse('Missing required field: complete', 400, 'MISSING_FIELDS');
  }

  try {
    const ctx = await getUserBusiness(auth.context.outsetaUid);
    if (!ctx) return errorResponse('No business found for user', 404, 'NOT_FOUND');

    const supabase = supabaseAdmin();
    await supabase
      .from('businesses')
      .update({ onboarding_complete: body.complete })
      .eq('id', ctx.businessId);

    return jsonResponse({ success: true, onboarding_complete: body.complete });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('onboarding-progress POST error:', message);
    return errorResponse('Failed to update onboarding status', 500, 'DATABASE_ERROR');
  }
}
