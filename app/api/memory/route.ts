/**
 * Memory API route
 *
 * GET /api/memory - Get formatted facts for AI context injection
 */

import { authenticateRequest, errorResponse, jsonResponse } from '@/lib/auth/middleware';
import { UserService, BusinessService, FactService, MemoryService } from '@/lib/services';
import type { MemoryResponse } from '@/lib/types/api';

export const runtime = 'edge';

/**
 * GET /api/memory
 *
 * Returns all facts for the user's active business formatted
 * as markdown suitable for AI context injection.
 */
export async function GET(request: Request): Promise<Response> {
  // Authenticate
  const auth = await authenticateRequest(request);
  if (!auth.success) {
    return errorResponse(auth.error, auth.status, 'UNAUTHORIZED');
  }

  try {
    // Get user (don't auto-create for GET)
    const user = await UserService.getByOutsetaUid(auth.context.outsetaUid);
    if (!user) {
      // User doesn't exist yet, return empty memory
      const response: MemoryResponse = { memory_context: '' };
      return jsonResponse(response);
    }

    // Get active business
    const business = await BusinessService.getActiveByUserId(user.id);
    if (!business) {
      // No business yet, return empty memory
      const response: MemoryResponse = { memory_context: '' };
      return jsonResponse(response);
    }

    // Get facts and format for AI
    const facts = await FactService.getByBusinessId(business.id);
    const memoryContext = MemoryService.formatForAI(facts);

    const response: MemoryResponse = {
      memory_context: memoryContext,
    };

    return jsonResponse(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to fetch memory:', message);
    return errorResponse('Failed to fetch memory', 500, 'DATABASE_ERROR');
  }
}
