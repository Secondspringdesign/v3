/**
 * Authentication middleware for API routes
 *
 * Extracts and verifies JWT from incoming requests.
 * Used by all authenticated API endpoints.
 */

import {
  verifyOutsetaToken,
  extractOutsetaUid,
  extractEmail,
  extractTokenFromHeader,
  getCookieValue,
  OUTSETA_COOKIE_NAME,
} from './jwt';
import type { AuthContext, ErrorResponse } from '../types/api';

// ============================================
// TYPES
// ============================================

export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; error: string; status: number };

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Authenticate an incoming request
 *
 * Extracts JWT from Authorization header (preferred) or cookie,
 * verifies it, and returns the authenticated user context.
 *
 * @param request - The incoming request
 * @returns AuthResult with context on success, error details on failure
 *
 * @example
 * ```ts
 * const auth = await authenticateRequest(request);
 * if (!auth.success) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.status });
 * }
 * const { outsetaUid, email } = auth.context;
 * ```
 */
export async function authenticateRequest(request: Request): Promise<AuthResult> {
  // Try Authorization header first, then cookie
  const authHeader = request.headers.get('Authorization');
  const cookieHeader = request.headers.get('Cookie');

  let token = extractTokenFromHeader(authHeader);
  if (!token) {
    token = getCookieValue(cookieHeader, OUTSETA_COOKIE_NAME);
  }

  if (!token) {
    return {
      success: false,
      error: 'Missing authentication token',
      status: 401,
    };
  }

  // Verify the token
  const result = await verifyOutsetaToken(token);

  if (!result.verified || !result.payload) {
    return {
      success: false,
      error: result.error || 'Invalid token',
      status: 401,
    };
  }

  // Extract user identifier
  const outsetaUid = extractOutsetaUid(result.payload);
  if (!outsetaUid) {
    return {
      success: false,
      error: 'Token missing user identifier',
      status: 401,
    };
  }

  const email = extractEmail(result.payload) ?? undefined;

  return {
    success: true,
    context: {
      outsetaUid,
      email,
    },
  };
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Create a JSON error response
 *
 * @param error - Error message
 * @param status - HTTP status code
 * @param code - Optional error code for client handling
 * @returns Response object
 */
export function errorResponse(
  error: string,
  status: number,
  code?: string
): Response {
  const body: ErrorResponse = { error };
  if (code) {
    body.code = code;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create a JSON success response
 *
 * @param data - Response data
 * @param status - HTTP status code (default 200)
 * @returns Response object
 */
export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
