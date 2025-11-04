// app/api/create-session/route.ts
import { WORKFLOW_ID } from "@/lib/config";

export const runtime = "edge";

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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

    const apiUrl = `${DEFAULT_CHATKIT_BASE}/v1/chatkit/sessions`;
    const upstreamResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        workflow: { id: WORKFLOW_ID },
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

// Helper functions (unchanged)
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
