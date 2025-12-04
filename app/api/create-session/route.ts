// app/api/create-session/route.ts
export const runtime = "edge";

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// Map of agents -> Agent Builder workflow ids
const WORKFLOWS: Record<string, string> = {
  // Business main
  business: "wf_68fee66360548190a298201183a30c3803a17f3de232e2c9",

  // Pillars
  product: "wf_69026b8145c48190985fa5cdd1d43adf0cbd88dcb5a45b06",
  marketing: "wf_69026bf3dd9881908d0321f4dcbcf2d600b6acefcbe3958d",
  finance: "wf_69026cf6ac808190be84ebde84951f970afd6254612434c0",

  // Business tasks
  reality_check: "wf_6931006dad1c8190ad53d84c5c4354b50bc61651b4ace412",
  swot: "wf_69310425a46881909175abe72281d39309c9a87a1d23696e",
  legal_tax: "wf_69310449b8d48190ac09298db62ddb3e0656a4dba7c3a2c4",
};

const OUTSETA_COOKIE_NAME = "outseta_access_token"; // client should set this cookie (or send Authorization header)
const OUTSETA_HEADER_NAME = (process.env.OUTSETA_TOKEN_HEADER as string) || "authorization"; // default: Authorization

// JWKS cache (simple in-memory TTL)
let jwksCache: { fetchedAt: number; jwks: unknown } | null = null;
const JWKS_TTL = 5 * 60 * 1000; // 5 minutes

// Preflight OPTIONS so the browser can send Authorization header
export async function OPTIONS(): Promise<Response> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": String(60 * 60 * 24),
  };
  return new Response(null, { status: 204, headers });
}

export async function POST(request: Request): Promise<Response> {
  let sessionCookie: string | null = null;
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return buildJsonResponse({ error: "Missing OPENAI_API_KEY" }, 500, {}, sessionCookie);
    }

    const url = new URL(request.url);
    // Default agent is now "business" instead of "strategy"
    const agent = (url.searchParams.get("agent") || "business").toLowerCase();
    const workflowId = WORKFLOWS[agent];

    if (!workflowId) {
      return buildJsonResponse({ error: `Invalid agent: ${agent}` }, 400, {}, sessionCookie);
    }

    // Resolve base user id (Outseta account uid or anon id)
    const { userId: rawUserId } = await resolveUserId(request);

    // Prevent accumulation of agent suffixes:
    // If rawUserId already contains one or more "-<agent>" suffixes (from earlier runs),
    // strip them before appending the current agent once.
    const agentList = Object.keys(WORKFLOWS)
      .map((a) => a.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
      .join("|");
    const stripRegex = new RegExp(`-(?:${agentList})(?:-(?:${agentList}))*$`, "i");
    const cleanedBase = String(rawUserId).replace(stripRegex, "");
    const namespacedUserId = `${cleanedBase}-${agent}`;

    // Set a session cookie with the namespaced id so repeat requests use same id
    sessionCookie = serializeSessionCookie(namespacedUserId);

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
        user: namespacedUserId,
        chatkit_configuration: { file_upload: { enabled: true } },
      }),
    });

    const upstreamJson = (await upstreamResponse.json().catch(() => ({}))) as unknown;

    if (!upstreamResponse.ok) {
      return buildJsonResponse(
        { error: "Failed to create session", details: upstreamJson },
        upstreamResponse.status,
        {},
        sessionCookie,
      );
    }

    const debug = String(process.env.OUTSETA_DEBUG ?? "").toLowerCase() === "true";

    const payload: Record<string, unknown> = {
      client_secret: (upstreamJson as Record<string, unknown>)?.client_secret,
      expires_after: (upstreamJson as Record<string, unknown>)?.expires_after,
      user_sent_to_chatkit: namespacedUserId,
    };
    if (debug) payload.resolved_base_user_id = rawUserId;

    return buildJsonResponse(payload, 200, {}, sessionCookie);
  } catch (error) {
    console.error("create-session error:", error);
    return buildJsonResponse({ error: "Unexpected error" }, 500, {}, sessionCookie);
  }
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
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    value,
  )}; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; HttpOnly; SameSite=None; Secure`;
}

/**
 * buildJsonResponse wraps JSON payload + status + headers and ensures CORS headers are present.
 */
function buildJsonResponse(
  payload: unknown,
  status: number,
  headers: Record<string, string>,
  sessionCookie: string | null,
): Response {
  const defaultCors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  const merged = { ...defaultCors, ...headers };
  const h = new Headers(merged);
  if (sessionCookie) h.append("Set-Cookie", sessionCookie);
  return new Response(JSON.stringify(payload), { status, headers: h });
}

function extractTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const parts = headerValue.trim().split(/\s+/);
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

/* ---------- Helpers: JWT parsing & verification ---------- */
function base64UrlDecodeToUint8Array(input: string): Uint8Array {
  let str = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  const raw = atob(str);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}
function base64UrlDecode(input: string): string {
  const arr = base64UrlDecodeToUint8Array(input);
  return new TextDecoder().decode(arr);
}
function parseJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  return {
    header: JSON.parse(base64UrlDecode(parts[0])) as Record<string, unknown>,
    payload: JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>,
    signatureB64: parts[2],
    signingInput: `${parts[0]}.${parts[1]}`,
  };
}

async function verifyOutsetaToken(token: string): Promise<{ verified: boolean; payload?: object }> {
  const secret = process.env.OUTSETA_JWT_SECRET;
  const jwksUrl = process.env.OUTSETA_JWKS_URL;
  const { header, payload, signatureB64, signingInput } = parseJwt(token);
  const sigBytes = base64UrlDecodeToUint8Array(signatureB64);
  const sigCopy = new Uint8Array(sigBytes);
  const sigArrayBuffer = sigCopy.buffer;
  const data = new TextEncoder().encode(signingInput);
  // rename to _headerAlg to avoid unused-variable lint error
  const _headerAlg = typeof header?.alg === "string" ? header.alg : undefined;
  const headerKid = typeof header?.kid === "string" ? header.kid : undefined;

  if (secret) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify("HMAC", key, sigArrayBuffer, data);
    return { verified: ok, payload: payload as object };
  } else if (jwksUrl) {
    const jwk = await getJwkForKid(jwksUrl, headerKid);
    if (!jwk) throw new Error("Unable to find matching JWK to verify token signature.");
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk as JsonWebKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sigArrayBuffer, data);
    return { verified: ok, payload: payload as object };
  } else {
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
    if (!kid) return (keys as unknown[]).find((k) => (k as Record<string, unknown>).kty === "RSA") ?? null;
    return (keys as unknown[]).find((k) => (k as Record<string, unknown>).kid === kid) ?? null;
  } catch (err) {
    console.warn("Error fetching JWKS:", err);
    return null;
  }
}

/* ---------- Resolve user id ---------- */
async function resolveUserId(request: Request) {
  const headerToken = extractTokenFromHeader(request.headers.get(OUTSETA_HEADER_NAME));
  const cookieToken = getCookieValue(request.headers.get("cookie"), OUTSETA_COOKIE_NAME);
  const token = headerToken || cookieToken;

  if (token) {
    try {
      const verified = await verifyOutsetaToken(token);
      if (verified && verified.payload) {
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

        if (accountUid) return { userId: accountUid, sessionCookie: serializeSessionCookie(accountUid) };
        console.warn("Outseta token verified but account UID not found in payload", payload);
      } else {
        console.warn("Outseta token not verified or could not be parsed.");
      }
    } catch (err) {
      console.warn("Outseta token verification failed:", err);
    }
  }

  // fallback to session cookie logic
  const existing = getCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (existing) return { userId: existing, sessionCookie: null };
  const generated = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  return { userId: generated, sessionCookie: serializeSessionCookie(generated) };
}
