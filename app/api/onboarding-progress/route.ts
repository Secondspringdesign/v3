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

// Business fact types that count toward business_facts_3 milestone
const BUSINESS_FACT_TYPES = [
  'business_name',
  'business_stage',
  'founder_background_summary',
  'vision_statement',
  'target_customer',
  'market_size',
  'primary_competitors',
];

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

  // Count goals
  const { count: goalsCount, error: goalsErr } = await supabase
    .from('goals')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
  
  if (goalsErr) throw goalsErr;

  // Count documents
  const { count: documentsCount, error: documentsErr } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
  
  if (documentsErr) throw documentsErr;

  // Calculate milestones
  const factsList = facts ?? [];
  
  // Milestone 1: business_name
  const hasBusinessName = factsList.some(
    f => f.fact_type_id === 'business_name' || f.fact_id === 'business_name'
  );

  // Milestone 2: business_facts_3 (at least 3 business facts)
  const businessFactsCount = factsList.filter(
    f => f.fact_type_id && BUSINESS_FACT_TYPES.includes(f.fact_type_id)
  ).length;
  const hasBusinessFacts3 = businessFactsCount >= 3;

  // Milestone 3: total_facts_5 (at least 5 total facts)
  const hasTotalFacts5 = factsList.length >= 5;

  // Milestone 4: first_planner_item
  const hasFirstPlannerItem = (plannerCount ?? 0) >= 1;

  // Milestone 5: first_goal
  const hasFirstGoal = (goalsCount ?? 0) >= 1;

  // Milestone 6: first_document
  const hasFirstDocument = (documentsCount ?? 0) >= 1;

  // Milestone 7: onboarding_done (all other milestones complete)
  const onboardingDone = hasBusinessName && hasBusinessFacts3 && hasTotalFacts5 && 
                          hasFirstPlannerItem && hasFirstGoal && hasFirstDocument;

  const milestones: Milestone[] = [
    { id: 'business_name', label: 'Name your business', done: hasBusinessName, weight: 15 },
    { id: 'business_facts_3', label: 'Add 3+ business facts', done: hasBusinessFacts3, weight: 20 },
    { id: 'total_facts_5', label: 'Fill out 5+ total facts', done: hasTotalFacts5, weight: 15 },
    { id: 'first_planner_item', label: 'Create your first task', done: hasFirstPlannerItem, weight: 15 },
    { id: 'first_goal', label: 'Set your first goal', done: hasFirstGoal, weight: 15 },
    { id: 'first_document', label: 'Upload your first file', done: hasFirstDocument, weight: 10 },
    { id: 'onboarding_done', label: 'Complete onboarding', done: onboardingDone, weight: 10 },
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
          { id: 'business_name', label: 'Name your business', done: false, weight: 15 },
          { id: 'business_facts_3', label: 'Add 3+ business facts', done: false, weight: 20 },
          { id: 'total_facts_5', label: 'Fill out 5+ total facts', done: false, weight: 15 },
          { id: 'first_planner_item', label: 'Create your first task', done: false, weight: 15 },
          { id: 'first_goal', label: 'Set your first goal', done: false, weight: 15 },
          { id: 'first_document', label: 'Upload your first file', done: false, weight: 10 },
          { id: 'onboarding_done', label: 'Complete onboarding', done: false, weight: 10 },
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
