export const runtime = "edge";

import {
  verifyOutsetaToken,
  extractOutsetaUid,
  extractEmail,
  extractTokenFromHeader,
  getCookieValue,
  OUTSETA_COOKIE_NAME,
} from "@/lib/auth/jwt";
import { createSupabaseAccessToken } from "@/lib/auth/supabase-jwt";

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  const cookieHeader = request.headers.get("Cookie");

  let token = extractTokenFromHeader(authHeader);
  if (!token) {
    token = getCookieValue(cookieHeader, OUTSETA_COOKIE_NAME);
  }

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing authentication token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const verified = await verifyOutsetaToken(token);
  if (!verified.verified || !verified.payload) {
    return new Response(JSON.stringify({ error: verified.error || "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const outsetaSub = extractOutsetaUid(verified.payload);
  if (!outsetaSub) {
    return new Response(JSON.stringify({ error: "Token missing user identifier" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = extractEmail(verified.payload) ?? undefined;

  const { accessToken, expiresIn, expiresAt } = await createSupabaseAccessToken({
    outsetaSub,
    email,
  });

  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      expires_at: expiresAt,
      sub: outsetaSub,
      email,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
}
