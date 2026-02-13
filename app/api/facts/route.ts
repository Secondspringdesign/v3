/**
 * Facts API route
 *
 * POST /api/facts - Create or update a fact (upsert)
 * GET /api/facts - List all facts for the user's active business
 */

import { authenticateRequest, errorResponse, jsonResponse } from "@/lib/auth/middleware";
import { UserService, BusinessService, FactService } from "@/lib/services";
import { toFactResponse } from "@/lib/types/api";
import type { CreateFactRequest, CreateFactResponse, FactsListResponse } from "@/lib/types/api";

export const runtime = "edge";

/**
 * POST /api/facts
 *
 * Create or update a fact for the user's active business.
 * Supports optional fact_type_id to target a predefined slot.
 */
export async function POST(request: Request): Promise<Response> {
  // Authenticate
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.error, auth.status, "UNAUTHORIZED");
  }

  // Parse and validate body
  let body: CreateFactRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, "INVALID_BODY");
  }

  if (!body.fact_id || typeof body.fact_id !== "string") {
    return errorResponse("Missing required field: fact_id", 400, "MISSING_FIELDS");
  }

  if (!body.fact_value || typeof body.fact_value !== "string") {
    return errorResponse("Missing required field: fact_value", 400, "MISSING_FIELDS");
  }

  try {
    // Get or create user
    const user = await UserService.getOrCreate(auth.context.outsetaUid, auth.context.email, auth.context.accountUid);

    // Get or create active business
    const business = await BusinessService.getOrCreateActive(user.id);

    // Upsert the fact (uses unique constraint on business_id,fact_type_id)
    const fact = await FactService.upsert({
      business_id: business.id,
      fact_id: body.fact_id,
      fact_value: body.fact_value,
      source_workflow: body.source_workflow ?? null,
      fact_type_id: body.fact_type_id ?? null,
    });

    const response: CreateFactResponse = {
      success: true,
      fact: toFactResponse(fact),
    };

    return jsonResponse(response, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to upsert fact:", message);
    return errorResponse("Failed to save fact", 500, "DATABASE_ERROR");
  }
}

/**
 * GET /api/facts
 *
 * List all facts for the user's active business.
 */
export async function GET(request: Request): Promise<Response> {
  // Authenticate
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.error, auth.status, "UNAUTHORIZED");
  }

  try {
    // Get user (don't auto-create for GET)
    const user = await UserService.getByOutsetaUid(auth.context.outsetaUid);
    if (!user) {
      const response: FactsListResponse = { facts: [] };
      return jsonResponse(response);
    }

    // Get active business
    const business = await BusinessService.getActiveByUserId(user.id);
    if (!business) {
      const response: FactsListResponse = { facts: [] };
      return jsonResponse(response);
    }

    // Get facts with type/category joins
    const facts = await FactService.getByBusinessId(business.id);

    const response: FactsListResponse = {
      facts: facts.map(toFactResponse),
    };

    return jsonResponse(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to fetch facts:", message);
    return errorResponse("Failed to fetch facts", 500, "DATABASE_ERROR");
  }
}
