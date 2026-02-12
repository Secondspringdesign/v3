/**
 * API request/response types
 * See: docs/spec-phase1-foundation.md for API specification
 */

import type { DbFact } from './database';

// ============================================
// AUTH CONTEXT
// ============================================

/** Authenticated user context extracted from JWT */
export interface AuthContext {
  outsetaUid: string;
  email?: string;
  accountUid?: string;
}

// ============================================
// FACTS API
// ============================================

/** POST /api/facts - Create or update a fact */
export interface CreateFactRequest {
  fact_id: string;
  fact_text: string;
  source_workflow?: string;
}

/** Fact data returned in API responses (subset of DbFact) */
export interface FactResponse {
  id: string;
  fact_id: string;
  fact_text: string;
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
}

/** POST /api/facts - Success response */
export interface CreateFactResponse {
  success: true;
  fact: FactResponse;
}

/** GET /api/facts - List all facts for user's active business */
export interface FactsListResponse {
  facts: FactResponse[];
}

/** DELETE /api/facts/:factId - Success response */
export interface DeleteFactResponse {
  success: true;
  deleted: string;
}

// ============================================
// MEMORY API
// ============================================

/** GET /api/memory - Formatted facts for AI context */
export interface MemoryResponse {
  memory_context: string;
}

// ============================================
// ERROR RESPONSES
// ============================================

export interface ErrorResponse {
  error: string;
  code?: string;
}

/** Common HTTP error codes used in API */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'MISSING_FIELDS'
  | 'NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

// ============================================
// UTILITY TYPES
// ============================================

/** Convert DbFact to FactResponse (omits business_id) */
export function toFactResponse(fact: DbFact): FactResponse {
  return {
    id: fact.id,
    fact_id: fact.fact_id,
    fact_text: fact.fact_text,
    source_workflow: fact.source_workflow,
    created_at: fact.created_at,
    updated_at: fact.updated_at,
  };
}
