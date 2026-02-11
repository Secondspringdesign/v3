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

export type BusinessStatus = 'active' | 'archived';

export interface DbBusiness {
  id: string;
  user_id: string;
  name: string;
  status: BusinessStatus;
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
}

// ============================================
// FACTS
// ============================================

export interface DbFact {
  id: string;
  business_id: string;
  fact_id: string;
  fact_text: string;
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
}

export interface FactInsert {
  business_id: string;
  fact_id: string;
  fact_text: string;
  source_workflow?: string | null;
}

/** For upsert operations - same as insert since we use ON CONFLICT */
export type FactUpsert = FactInsert;

export interface FactUpdate {
  fact_text?: string;
  source_workflow?: string | null;
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
