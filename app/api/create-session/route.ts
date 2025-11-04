// app/api/create-session/route.ts
export const runtime = "edge";

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const WORKFLOWS: Record<string, string> = {
  strategy: "wf_68fee66360548190a298201183a30c3803a17f3de232e2c9",
  product: "wf_69026b8145c48190985fa5cdd1d43adf0cbd88dcb5a45b06",
  marketing: "wf_69026bf3dd9881908d0321f4dcbcf2d600b6acefcbe3958d",
  operations: "wf_69026cf6ac808190be84ebde84951f970afd6254612434c0",
};

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

    const upstreamJson = (await upstreamResponse.json().catch(() => ({}))) as Record<string, unknown>;

    if (!upstreamResponse.ok) {
      return buildJsonResponse(
        { error: "Failed to create session", details: upstreamJson },
        upstreamResponse.status,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    return buildJsonResponse(
      {
        client_secret: upstreamJson?.client_secret,
        expires_after: upstreamJson?.expires_after,
      },
      200,
      { "Content-Type": "application/json" },
      sessionCookie
    );
  } catch (error) {
    return buildJsonResponse(
      { error: "Unexpected error" },
      500,
      { "Content-Type": "application/json" },
      sessionCookie
    );
  }
}

async function resolveUserId(request: Request) {
  const existing = getCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  if (existing) return { userId: existing, sessionCookie: null };
  const generated = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  return { userId: generated, sessionCookie: serializeSessionCookie(generated) };
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

function serializeSessionCookie(value: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; HttpOnly; SameSite=None; Secure`;
}

function buildJsonResponse(payload: unknown, status: number, headers: Record<string, string>, sessionCookie: string | null): Response {
  const h = new Headers(headers);
  if (sessionCookie) h.append("Set-Cookie", sessionCookie);
  return new Response(JSON.stringify(payload), { status, headers: h });
}
