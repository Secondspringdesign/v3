/**
 * Individual fact API route
 *
 * DELETE /api/facts/:factId - Delete a specific fact by fact_id
 */

import { authenticateRequest, errorResponse, jsonResponse } from "@/lib/auth/middleware";
import { UserService, BusinessService, FactService } from "@/lib/services";
import type { DeleteFactResponse } from "@/lib/types/api";

export const runtime = "edge";

interface RouteParams {
  params: Promise<{ factId: string }>;
}

/**
 * DELETE /api/facts/:factId
 *
 * Delete a specific fact by its fact_id (not UUID).
 * Returns 404 if the fact doesn't exist.
 */
export async function DELETE(request: Request, { params }: RouteParams): Promise<Response> {
  // Authenticate
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.error, auth.status, "UNAUTHORIZED");
  }

  const { factId } = await params;

  if (!factId) {
    return errorResponse("Missing fact_id parameter", 400, "MISSING_FIELDS");
  }

  try {
    // Get user
    const user = await UserService.getByOutsetaUid(auth.context.outsetaUid);
    if (!user) {
      return errorResponse("Fact not found", 404, "NOT_FOUND");
    }

    // Get active business
    const business = await BusinessService.getActiveByUserId(user.id);
    if (!business) {
      return errorResponse("Fact not found", 404, "NOT_FOUND");
    }

    // Delete the fact
    const deleted = await FactService.deleteByFactId(business.id, factId);

    if (!deleted) {
      return errorResponse("Fact not found", 404, "NOT_FOUND");
    }

    const response: DeleteFactResponse = {
      success: true,
      deleted: factId,
    };

    return jsonResponse(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Failed to delete fact:", message);
    return errorResponse("Failed to delete fact", 500, "DATABASE_ERROR");
  }
}
