/**
 * Database entity types matching Supabase schema
 * See: supabase/migrations/001_foundation.sql
 */

// ============================================
// USERS
// ============================================

export interface DbUser {
  id: string;
  outseta_uid: string;
  account_uid: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserInsert {
  outseta_uid: string;
  account_uid?: string | null;
  email?: string | null;
}

export interface UserUpdate {
  account_uid?: string | null;
  email?: string | null;
}

// ============================================
// BUSINESSES
// ============================================

export type BusinessStatus = "active" | "archived";

export interface DbBusiness {
  id: string;
  user_id: string;
  name: string;
  status: BusinessStatus;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessInsert {
  user_id: string;
  name?: string;
  status?: BusinessStatus;
}

export interface BusinessUpdate {
  name?: string;
  status?: BusinessStatus;
  onboarding_complete?: boolean;
}

// ============================================
// FACTS
// ============================================

export interface DbFact {
  id: string;
  business_id: string;
  fact_id: string;
  fact_value: string; // renamed from fact_text
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
  fact_type_id: string | null;
  // joined fields (optional)
  fact_type_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
}

export interface FactInsert {
  business_id: string;
  fact_id: string;
  fact_value: string;
  source_workflow?: string | null;
  fact_type_id?: string | null;
}

/** For upsert operations - same as insert */
export type FactUpsert = FactInsert;

export interface FactUpdate {
  fact_value?: string;
  source_workflow?: string | null;
  fact_type_id?: string | null;
}

// ============================================
// DOCUMENTS (Phase 2 placeholder)
// ============================================

export interface DbDocument {
  id: string;
  business_id: string;
  document_type: string;
  title: string | null;
  content: Record<string, unknown> | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentInsert {
  business_id: string;
  document_type: string;
  title?: string | null;
  content?: Record<string, unknown> | null;
  version?: number;
}

export interface DocumentUpdate {
  title?: string | null;
  content?: Record<string, unknown> | null;
  version?: number;
}

// ============================================
// PILLARS (read-only lookup)
// ============================================

export type PillarId = "business" | "product" | "marketing" | "money";

export interface DbPillar {
  id: PillarId;
  name: string;
  color: string | null;
  icon: string | null;
  display_order: number;
  created_at: string;
}

// ============================================
// PLANNER
// ============================================

export type DuePeriod = "today" | "this_week" | "next_week" | "this_month" | "this_quarter";

export interface DbPlannerItem {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  due_date: string | null; // DATE as ISO string
  due_period: DuePeriod;
  pillar_id: PillarId | null;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlannerItemInsert {
  business_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  due_period: DuePeriod;
  pillar_id?: PillarId | null;
  completed?: boolean;
  sort_order?: number;
  source_workflow?: string | null;
}

export interface PlannerItemUpdate {
  title?: string;
  description?: string | null;
  due_date?: string | null;
  due_period?: DuePeriod;
  pillar_id?: PillarId | null;
  completed?: boolean;
  completed_at?: string | null;
  sort_order?: number;
}

// ============================================
// GOALS
// ============================================

export type TimeHorizon = "this_week" | "this_month" | "this_quarter";
export type GoalStatus = "active" | "achieved" | "archived";

export interface DbGoal {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  time_horizon: TimeHorizon;
  pillar_id: PillarId | null;
  status: GoalStatus;
  achieved_at: string | null;
  sort_order: number;
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalInsert {
  business_id: string;
  title: string;
  description?: string | null;
  time_horizon: TimeHorizon;
  pillar_id?: PillarId | null;
  status?: GoalStatus;
  sort_order?: number;
  source_workflow?: string | null;
}

export interface GoalUpdate {
  title?: string;
  description?: string | null;
  time_horizon?: TimeHorizon;
  pillar_id?: PillarId | null;
  status?: GoalStatus;
  achieved_at?: string | null;
  sort_order?: number;
}
