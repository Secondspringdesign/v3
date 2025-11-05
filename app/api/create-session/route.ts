// app/api/create-session/route.ts
export const runtime = "edge";

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// Map of agents -> Agent Builder workflow ids
const WORKFLOWS: Record<string, string> = {
  strategy: "wf_68fee66360548190a298201183a30c3803a17f3de232e2c9",
  product: "wf_69026b8145c48190985fa5cdd1d43adf0cbd88dcb5a45b06",
  marketing: "wf_69026bf3dd9881908d0321f4dcbcf2d600b6acefcbe3958d",
  operations: "wf_69026cf6ac808190be84ebde84951f970afd6254612434c0",
};

const OUTSETA_COOKIE_NAME = "outseta_access_token"; // client should set this cookie (or send Authorization header)
const OUTSETA_HEADER_NAME = (process.env.OUTSETA_TOKEN_HEADER as string) || "authorization"; // default: Authorization

// JWKS cache (simple in-memory TTL)
let jwksCache: { fetchedAt: number; jwks: unknown } | null = null;
const JWKS_TTL = 5 * 60 * 1000; // 5 minutes

export async function POST(request: Request): Promise<Response> {
  let sessionCookie: string | null = null;
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Attempt to resolve user id (this will verify token if provided & configured)
    const { userId, sessionCookie: resolvedSessionCookie } = await resolveUserId(request);
    sessionCookie = resolvedSessionCookie;

    const url = new URL(request.url);
    const agent = url.searchParams.get("agent") || "strategy";
    const workflowId = WORKFLOWS[agent];

    if (!workflowId) {
      return buildJsonResponse(
        { error: `Invalid agent: ${agent}` },
        400,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    const apiUrl = `${DEFAULT_CHATKIT_BASE}/v1/chatkit/sessions`;
    const upstreamResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: userId,
        chatkit_configuration: { file_upload: { enabled: true } },
      }),
    });

    const upstreamJson = (await upstreamResponse.json().catch(() => ({}))) as unknown;

    if (!upstreamResponse.ok) {
      return buildJsonResponse(
        { error: "Failed to create session", details: upstreamJson },
        upstreamResponse.status,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    // Optionally include resolved user id in response for debugging
    const debug = String(process.env.OUTSETA_DEBUG ?? "").toLowerCase() === "true";

    const payload: Record<string, unknown> = {
      client_secret: (upstreamJson as Record<string, unknown>)?.client_secret,
      expires_after: (upstreamJson as Record<string, unknown>)?.expires_after,
    };
    if (debug) payload.resolved_user_id = userId;

    return buildJsonResponse(payload, 200, { "Content-Type": "application/json" }, sessionCookie);
  } catch (error) {
    console.error("create-session error:", error);
    return buildJsonResponse(
      { error: "Unexpected error" },
      500,
      { "Content-Type": "application/json" },
      sessionCookie
    );
  }
}

/**
 * Resolve a user id to pass to ChatKit.
 *
 * Priority:
 * 1) If a valid Outseta token is present and verified, use the extracted Outseta account UID (payload["outseta:accountUid"]).
 * 2) If an existing session cookie exists, use that.
 * 3) Otherwise generate a random id and set it as a session cookie (same as original behavior).
 */
async function resolveUserId(request: Request) {
  // 1) Check for token in Authorization header or cookie
  const headerToken = extractTokenFromHeader(request.headers.get(OUTSETA_HEADER_NAME));
  const cookieToken = getCookieValue(request.headers.get("cookie"), OUTSETA_COOKIE_NAME);
  const token = headerToken || cookieToken;

  if (token) {
    try {
      const verified = await verifyOutsetaToken(token);
      if (verified && verified.payload) {
        // Prefer the Outseta namespaced claim first
        const payload = verified.payload as Record<string, unknown>;
        const accountUid =
          (payload["outseta:accountUid"] as string) ||
          (payload["outseta:accountuid"] as string) ||
          (payload["account_uid"] as string) ||
          (payload["accountUid"] as string) ||
          (payload["accountId"] as string) ||
          (payload["account_id"] as string) ||
          (payload["sub"] as string) ||
          (payload["user_id"] as string) ||
          (payload["uid"] as string) ||
          undefined;

        if (accountUid) {
          // Use the Outseta account UID as the ChatKit user id and set a session cookie
          return { userId: accountUid, sessionCookie: serializeSessionCookie(accountUid) };
        } else {
          console.warn("Outseta token verified but account UID not found in payload", payload);
        }
      } else {
        console.warn("Outseta token not verified or could not be parsed.");
      }
    } catch (err) {
      console.warn("Outseta token verification failed:", err);
      // proceed to fallback behavior
    }
  }

  // 2) If no token or verification failed, fallback to session cookie logic
  const existing = getCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (existing) return { userId: existing, sessionCookie: null };
  const generated = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  return { userId: generated, sessionCookie: serializeSessionCookie(generated) };
}

/* ---------- Helpers: cookies & response building ---------- */
function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split("=");
    if (rawName?.trim() === name) return rest.join("=").trim();
  }
  return null;
}

function serializeSessionCookie(value: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; HttpOnly; SameSite=None; Secure`;
}

function buildJsonResponse(
  payload: unknown,
  status: number,
  headers: Record<string, string>,
  sessionCookie: string | null
): Response {
  const h = new Headers(headers);
  if (sessionCookie) h.append("Set-Cookie", sessionCookie);
  return new Response(JSON.stringify(payload), { status, headers: h });
}

function extractTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  // header e.g. "Bearer <token>"
  const parts = headerValue.trim().split(/\s+/);
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  // also allow passing token directly
  if (parts.length === 1) return parts[0];
  return null;
}

/* ---------- Helpers: JWT parsing & verification ---------- */

function base64UrlDecodeToUint8Array(input: string): Uint8Array {
  // base64url -> base64
  let str = input.replace(/-/g, "+").replace(/_/g, "/");
  // pad
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  const raw = atob(str);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

function base64UrlDecode(input: string): string {
  const arr = base64UrlDecodeToUint8Array(input);
  // decode UTF-8
  return new TextDecoder().decode(arr);
}

function parseJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const headerJson = JSON.parse(base64UrlDecode(parts[0]));
  const payloadJson = JSON.parse(base64UrlDecode(parts[1]));
  return {
    header: headerJson as Record<string, unknown>,
    payload: payloadJson as Record<string, unknown>,
    signatureB64: parts[2],
    signingInput: `${parts[0]}.${parts[1]}`,
  };
}

/**
 * Verify an Outseta JWT. Supports:
 *  - HS256 using OUTSETA_JWT_SECRET env var
 *  - RS256 using OUTSETA_JWKS_URL env var
 *
 * Returns { verified: boolean, payload }.
 * If no verification mechanism configured, returns { verified: false, payload } (decoded).
 */
async function verifyOutsetaToken(token: string): Promise<{ verified: boolean; payload?: object }> {
  const secret = process.env.OUTSETA_JWT_SECRET;
  const jwksUrl = process.env.OUTSETA_JWKS_URL;

  // Parse token parts
  const { header, payload, signatureB64, signingInput } = parseJwt(token);
  const sigBytes = base64UrlDecodeToUint8Array(signatureB64);
  const data = new TextEncoder().encode(signingInput);

  const headerAlg = typeof header?.alg === "string" ? header.alg : undefined;
  const headerKid = typeof header?.kid === "string" ? header.kid : undefined;

  if (secret) {
    // HS256 verification using HMAC-SHA256
    if (!headerAlg || headerAlg !== "HS256") {
      console.warn("Token alg is not HS256 but OUTSETA_JWT_SECRET is provided; attempting verification anyway.");
    }
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify("HMAC", key, sigBytes, data);
    return { verified: ok, payload: payload as object };
  } else if (jwksUrl) {
    // RS256 verification via JWKS
    if (!headerAlg || !headerAlg.startsWith("RS")) {
      console.warn("Token alg does not indicate RS* but OUTSETA_JWKS_URL is provided; attempting verification anyway.");
    }
    const jwk = await getJwkForKid(jwksUrl, headerKid);
    if (!jwk) throw new Error("Unable to find matching JWK to verify token signature.");

    // Import JWK and verify signature
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk as JsonWebKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sigBytes, data);
    return { verified: ok, payload: payload as object };
  } else {
    // No verification configured — decode only (insecure)
    console.warn("No OUTSETA_JWT_SECRET or OUTSETA_JWKS_URL configured — token will not be signature-verified.");
    return { verified: false, payload: payload as object };
  }
}

async function getJwkForKid(jwksUrl: string, kid?: string): Promise<unknown | null> {
  try {
    const now = Date.now();
    if (!jwksCache || now - jwksCache.fetchedAt > JWKS_TTL) {
      const res = await fetch(jwksUrl);
      if (!res.ok) throw new Error(`Failed to fetch JWKS (${res.status})`);
      const jwks = await res.json();
      jwksCache = { fetchedAt: now, jwks };
    }
    const keys = (jwksCache.jwks as Record<string, unknown>)?.keys ?? [];
    if (!kid) {
      // If no kid, use first RSA public key
      return (keys as unknown[]).find((k) => (k as Record<string, unknown>).kty === "RSA") ?? null;
    }
    return (keys as unknown[]).find((k) => (k as Record<string, unknown>).kid === kid) ?? null;
  } catch (err) {
    console.warn("Error fetching JWKS:", err);
    return null;
  }
}
