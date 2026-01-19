export const runtime = "edge";

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Outseta
const OUTSETA_COOKIE_NAME = "outseta_access_token";
const OUTSETA_ISSUER = "https://second-spring-design.outseta.com";
const OUTSETA_JWKS_URL = "https://second-spring-design.outseta.com/.well-known/jwks";

const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL = 24 * 60 * 60 * 1000;

// JWKS cache
let jwksCache: { fetchedAt: number; jwks: unknown } | null = null;

// Map of agents -> workflow ids (prefer server-side; fallback to NEXT_PUBLIC_)
const WORKFLOWS: Record<string, string | undefined> = {
  business: process.env.CHATKIT_WORKFLOW_BUSINESS ?? process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS,
  business_task1:
    process.env.CHATKIT_WORKFLOW_BUSINESS_TASK1 ?? process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK1,
  business_task2:
    process.env.CHATKIT_WORKFLOW_BUSINESS_TASK2 ?? process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK2,
  business_task3:
    process.env.CHATKIT_WORKFLOW_BUSINESS_TASK3 ?? process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK3,
  business_task4: process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK4,
  product: process.env.CHATKIT_WORKFLOW_PRODUCT ?? process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_PRODUCT,
  marketing: process.env.CHATKIT_WORKFLOW_MARKETING ?? process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_MARKETING,
  money: process.env.CHATKIT_WORKFLOW_MONEY ?? process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_MONEY,
};

// ---------- CORS preflight ----------
export async function OPTIONS(): Promise<Response> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": String(60 * 60 * 24),
  };
  return new Response(null, { status: 204, headers });
}

// ---------- Main handler ----------
export async function POST(request: Request): Promise<Response> {
  let sessionCookie: string | null = null;
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return buildJsonResponse({ error: "Missing OPENAI_API_KEY" }, 500, {}, sessionCookie);
    }

    const url = new URL(request.url);
    const agent = (url.searchParams.get("agent") || "business").toLowerCase();
    const workflowId = WORKFLOWS[agent];

    if (!workflowId) {
      return buildJsonResponse({ error: `Invalid or missing workflow for agent: ${agent}` }, 400, {}, sessionCookie);
    }

    // Resolve user id (Outseta only)
    const { userId: rawUserId, outsetaSub } = await resolveUserId(request);

    // Strip prior agent suffixes and append current agent
    const agentList = Object.keys(WORKFLOWS)
      .map((a) => a.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
      .join("|");
    const stripRegex = new RegExp(`-(?:${agentList})(?:-(?:${agentList}))*$`, "i");
    const cleanedBase = String(rawUserId).replace(stripRegex, "");
    const namespacedUserId = `${cleanedBase}-${agent}`;

    // Session cookie for stability
    sessionCookie = serializeSessionCookie(namespacedUserId);

    // Fetch facts summary for this user (server-side, service role + RPC filtered by outseta_sub)
    const factsSummary = await fetchFactsSummary(outsetaSub);

    // Call ChatKit Sessions API with inputs (includes facts_summary)
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
        inputs: {
          facts_summary: factsSummary || "No facts found yet.",
        },
        chatkit_configuration: {
          file_upload: { enabled: true },
        },
      }),
    });

    const upstreamJson = (await upstreamResponse.json().catch(() => ({}))) as Record<string, unknown>;

    if (!upstreamResponse.ok) {
      return buildJsonResponse(
        { error: "Failed to create session", details: upstreamJson },
        upstreamResponse.status,
        {},
        sessionCookie,
      );
    }

    const payload: Record<string, unknown> = {
      client_secret: upstreamJson.client_secret,
      expires_after: upstreamJson.expires_after,
      user_sent_to_chatkit: namespacedUserId,
      injected_facts: Boolean(factsSummary),
    };

    return buildJsonResponse(payload, 200, {}, sessionCookie);
  } catch (error) {
    console.error("create-session error:", error);
    return buildJsonResponse(
      { error: "Missing or invalid authentication token. Please log in again or refresh." },
      401,
      {},
      sessionCookie,
    );
  }
}

// ---------- Helpers ----------
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

function serializeSessionCookie(value: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    value,
  )}; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; HttpOnly; SameSite=None; Secure`;
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split("=");
    if (rawName?.trim() === name) return rest.join("=").trim();
  }
  return null;
}

function extractTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const parts = headerValue.trim().split(/\s+/);
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

/* ---------- Outseta verification (RS256 via JWKS) ---------- */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 2 ? "==" : base64.length % 4 === 3 ? "=" : "";
  const normalized = base64 + pad;
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(normalized, "base64"));
  const binary = atob(normalized);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
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

async function verifyOutsetaToken(token: string): Promise<{ verified: boolean; payload?: object }> {
  const { header, payload, signatureB64, signingInput } = parseJwt(token);
  const jwk = await getJwkForKid(OUTSETA_JWKS_URL, typeof header.kid === "string" ? header.kid : undefined);
  if (!jwk) return { verified: false, payload };
  const sigArray = base64UrlToUint8Array(signatureB64);
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    sigArray as unknown as BufferSource,
    new TextEncoder().encode(signingInput) as unknown as BufferSource,
  );

  // exp / nbf / iss checks
  const now = Math.floor(Date.now() / 1000);
  const exp = payload.exp as number | undefined;
  const nbf = payload.nbf as number | undefined;
  const iss = payload.iss as string | undefined;
  if (typeof exp === "number" && exp < now - CLOCK_SKEW_SECONDS) return { verified: false, payload };
  if (typeof nbf === "number" && nbf > now + CLOCK_SKEW_SECONDS) return { verified: false, payload };
  if (iss && iss !== OUTSETA_ISSUER) return { verified: false, payload };

  return { verified: ok, payload };
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

/* ---------- Resolve user id ---------- */
async function resolveUserId(request: Request) {
  const headerToken = extractTokenFromHeader(request.headers.get("authorization"));
  const cookieToken = getCookieValue(request.headers.get("cookie"), OUTSETA_COOKIE_NAME);
  const token = headerToken || cookieToken;

  if (!token) {
    throw new Error("Missing authentication token");
  }

  try {
    const verified = await verifyOutsetaToken(token);
    if (verified?.verified && verified.payload) {
      const payload = verified.payload as Record<string, unknown>;
      const userSub =
        (payload["sub"] as string) ||
        (payload["user_id"] as string) ||
        (payload["uid"] as string) ||
        undefined;

      if (userSub) return { userId: userSub, sessionCookie: serializeSessionCookie(userSub), outsetaSub: userSub };
    }
  } catch (err) {
    console.warn("Outseta token verification failed:", err);
  }

  throw new Error("Invalid authentication token");
}

/* ---------- Facts fetch + summary (user-scoped via RPC) ---------- */
async function fetchFactsSummary(outsetaSub: string): Promise<string> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; skipping facts injection");
    return "";
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/user_facts`, {
      method: "POST",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ p_sub: outsetaSub }),
    });

    if (!res.ok) {
      console.warn("Failed to fetch user_facts:", res.status, await res.text());
      return "";
    }
    const rows = (await res.json()) as Array<{
      fact_id: string;
      fact_text: string;
      source_workflow?: string | null;
      updated_at?: string | null;
    }>;

    if (!rows?.length) return "";

    // Simple summary; trim to keep within token budget
    const parts = rows.slice(0, 30).map((r) => {
      const src = r.source_workflow ? ` (source: ${r.source_workflow})` : "";
      return `- ${r.fact_id}: ${r.fact_text}${src}`;
    });
    return parts.join("\n");
  } catch (err) {
    console.warn("Error fetching user_facts:", err);
    return "";
  }
}
