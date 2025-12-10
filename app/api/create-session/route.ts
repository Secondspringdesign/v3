import { NextRequest, NextResponse } from "next/server";

// ---- Your existing constants and types ----

// We keep OUTSETA_JWKS_URL as you already set it:
const OUTSETA_JWKS_URL = "https://second-spring-design.outseta.com/.well-known/jwks";

// You already have VerifiedToken, JwksCache, JWKS_TTL, jwksCache, etc.
// Keeping your existing utilities: base64UrlToUint8Array, getCookieValue, serializeSessionCookie,
// extractTokenFromHeader, getJwkForKid, verifyOutsetaToken.
// I’m only changing two things inside resolveUserId, and how we pick the header name.

// If you previously had these names:
const SESSION_COOKIE_NAME = "chatkit_session_id";
// OUTSETA_COOKIE_NAME pointing at your Outseta cookie (if any)
const OUTSETA_COOKIE_NAME = "outseta_access_token";

// Helper: parse "Bearer <token>" or raw token
function extractTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const parts = headerValue.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return headerValue.trim();
}

// ... your existing base64UrlToUint8Array, getCookieValue, serializeSessionCookie,
// getJwkForKid, verifyOutsetaToken functions should remain here, unchanged,
// EXCEPT for OUTSETA_JWKS_URL already pointing at your subdomain.

// ---------- RESOLVE USER ID (this is the key change) ----------

async function resolveUserId(request: Request): Promise<{
  userId: string | null;
  sessionCookie: string | null;
  error?: string;
}> {
  // 1) CHANGE: read Outseta token from Authorization header, because ChatKitPanel
  // sends headers["Authorization"] = `Bearer ${outsetaToken}`;
  const headerToken = extractTokenFromHeader(request.headers.get("authorization"));

  // 2) Optional: also look for a dedicated Outseta cookie if you have one.
  const cookieToken = getCookieValue(request.headers.get("cookie"), OUTSETA_COOKIE_NAME);

  const token = headerToken || cookieToken;

  if (!token) {
    console.warn("[create-session] No Outseta access token found in headers or cookies.");
    return { userId: null, sessionCookie: null, error: "Missing Outseta access token" };
  }

  try {
    const verified = await verifyOutsetaToken(token);
    if (!verified.verified || !verified.payload) {
      console.warn("[create-session] Outseta token failed verification.");
      return { userId: null, sessionCookie: null, error: "Invalid Outseta access token" };
    }

    const payload = verified.payload as Record<string, unknown>;

    // 3) CHANGE: Universal user id comes from Outseta's recommended `sub` claim.
    const userIdFromToken =
      (payload["sub"] as string) ||
      (payload["user_id"] as string) ||
      (payload["uid"] as string) ||
      undefined;

    // 4) OPTIONAL: account id fallback (for account-scoped behavior only, not preferred)
    const accountIdFromToken =
      (payload["outseta:accountUid"] as string) ||
      (payload["outseta:accountuid"] as string) ||
      (payload["account_uid"] as string) ||
      (payload["accountUid"] as string) ||
      (payload["accountId"] as string) ||
      (payload["account_id"] as string) ||
      undefined;

    if (userIdFromToken) {
      console.log("[create-session] Using Outseta sub as userId:", userIdFromToken);
      return {
        userId: userIdFromToken,
        sessionCookie: serializeSessionCookie(userIdFromToken),
      };
    }

    console.warn(
      "[create-session] Outseta token verified but user id (sub) not found in payload",
      payload,
    );

    // LAST RESORT: account id as user id (not recommended for true per-user history)
    if (accountIdFromToken) {
      console.log("[create-session] Falling back to account id as userId:", accountIdFromToken);
      return {
        userId: accountIdFromToken,
        sessionCookie: serializeSessionCookie(accountIdFromToken),
      };
    }

    return { userId: null, sessionCookie: null, error: "No suitable user id in Outseta token" };
  } catch (err) {
    console.warn("[create-session] Outseta token verification failed:", err);
    return { userId: null, sessionCookie: null, error: "Error verifying Outseta token" };
  }

  // IMPORTANT: we do NOT silently generate a random cookie id here.
  // If there’s no valid Outseta token, we want to fail, not create a new identity.
}

// ---------- POST HANDLER (keep your logic, just gate on userId) ----------

export async function POST(request: NextRequest) {
  const { userId, sessionCookie, error } = await resolveUserId(request);

  if (!userId) {
    // Strict behavior: do not proceed without a valid Outseta user
    return NextResponse.json(
      {
        error: error ?? "Unable to resolve user from Outseta",
      },
      { status: 401 },
    );
  }

  // --- KEEP YOUR EXISTING SESSION CREATION LOGIC HERE ---
  // You likely already:
  // - talk to your orchestrator / Agent Builder backend
  // - create or load a ChatKit session keyed by this userId
  // - return { client_secret, ... } or whatever your ChatKitPanel expects

  // Example stub (replace with your actual logic):
  // const { client_secret, ...rest } = await createChatSessionForUser(userId, request);
  // const body = { client_secret, ...rest };

  const body = { userId }; // placeholder, replace with your existing response

  const res = NextResponse.json(body);

  if (sessionCookie) {
    res.headers.set("Set-Cookie", sessionCookie);
  }

  return res;
}
