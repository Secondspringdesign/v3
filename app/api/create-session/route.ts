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
  business_task4:
    process.env.CHATKIT_WORKFLOW_BUSINESS_TASK4 ?? process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK4,
  planner:
    process.env.CHATKIT_WORKFLOW_BUSINESS_TASK4 ?? process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK4, // <--- alias for UI/URL/human-friendly id, optional
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

    // Resolve user id (Outseta or fallback)
    const { userId: rawUserId } = await resolveUserId(request);

    // Strip prior agent suffixes and append current agent
    const agentList = Object.keys(WORKFLOWS)
      .map((a) => a.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
      .join("|");
    const stripRegex = new RegExp(`-(?:${agentList})(?:-(?:${agentList}))*$`, "i");
    const cleanedBase = String(rawUserId).replace(stripRegex, "");
    const namespacedUserId = `${cleanedBase}-${agent}`;

    // Session cookie for stability
    sessionCookie = serializeSessionCookie(namespacedUserId);

    // Call ChatKit Sessions API (old, working shape)
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
    };

    return buildJsonResponse(payload, 200, {}, sessionCookie);
  } catch (error) {
    console.error("create-session error:", error);
    return buildJsonResponse({ error: "Unexpected error" }, 500, {}, sessionCookie);
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

// ... any other untouched code after this
