/**
 * API request/response types
 * See: docs/spec-phase1-foundation.md for API specification
 */

import type { DbFact } from "./database";

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
  fact_value: string;
  source_workflow?: string;
  fact_type_id?: string | null; // optional: when set, upsert into that predefined slot
}

/** Fact data returned in API responses (subset of DbFact plus joins) */
export interface FactResponse {
  id: string;
  fact_id: string;
  fact_value: string;
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
  fact_type_id: string | null;
  fact_type_name: string | null;
  category_id: string | null;
  category_name: string | null;
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
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "MISSING_FIELDS"
  | "NOT_FOUND"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

// ============================================
// UTILITY TYPES
// ============================================

/** Convert DbFact (with joins) to FactResponse */
export function toFactResponse(fact: DbFact): FactResponse {
  const factValue =
    typeof fact.fact_value === "string"
      ? fact.fact_value
      : // backward compatibility if a row still has fact_text
        (fact as unknown as { fact_text?: string | null }).fact_text ?? "";

  return {
    id: fact.id,
    fact_id: fact.fact_id,
    fact_value: factValue,
    source_workflow: fact.source_workflow ?? null,
    created_at: fact.created_at,
    updated_at: fact.updated_at,
    fact_type_id: fact.fact_type_id ?? null,
    fact_type_name: fact.fact_type_name ?? null,
    category_id: fact.category_id ?? null,
    category_name: fact.category_name ?? null,
  };
}
