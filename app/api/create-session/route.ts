import { NextRequest, NextResponse } from "next/server";

const OUTSETA_JWKS_URL = "https://second-spring-design.outseta.com/.well-known/jwks";
const OUTSETA_ISSUER = "https://second-spring-design.outseta.com";
const OUTSETA_COOKIE_NAME = "outseta_access_token";
const SESSION_COOKIE_NAME = "chatkit_session_id";

const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL = 24 * 60 * 60 * 1000;

type VerifiedToken = {
  verified: boolean;
  payload?: Record<string, unknown>;
  error?: string;
};

type JwksCache = {
  fetchedAt: number;
  jwks: unknown;
};

let jwksCache: JwksCache | null = null;

/* ---------- Helpers ---------- */

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

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const c of cookies) {
    const [k, ...rest] = c.split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function serializeSessionCookie(userId: string): string {
  const maxAgeSeconds = 60 * 60 * 24 * 365;
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    userId,
  )}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${maxAgeSeconds}; Priority=High`;
}

function extractTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const parts = headerValue.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return headerValue.trim();
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

async function verifyOutsetaToken(token: string): Promise<VerifiedToken> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) throw new Error("Invalid JWT format");

    const headerJson = Buffer.from(headerB64, "base64url").toString("utf8");
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");

    const header = JSON.parse(headerJson) as { kid?: string; alg?: string; typ?: string };
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;

    if (header.alg && header.alg !== "RS256") throw new Error(`Unexpected alg: ${header.alg}`);

    const sigArray = base64UrlToUint8Array(signatureB64);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    const jwk = await getJwkForKid(OUTSETA_JWKS_URL, header.kid);
    if (!jwk) throw new Error("Unable to find matching JWK to verify token signature.");

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
      data as unknown as BufferSource,
    );

    if (!ok) throw new Error("Signature verification failed");

    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp as number | undefined;
    const nbf = payload.nbf as number | undefined;
    const iss = payload.iss as string | undefined;

    if (typeof exp === "number" && exp < now - CLOCK_SKEW_SECONDS) throw new Error("Token expired");
    if (typeof nbf === "number" && nbf > now + CLOCK_SKEW_SECONDS) throw new Error("Token not yet valid");
    if (iss && iss !== OUTSETA_ISSUER) throw new Error(`Unexpected issuer: ${iss}`);

    return { verified: true, payload };
  } catch (err) {
    console.warn("verifyOutsetaToken error:", err);
    return { verified: false, error: err instanceof Error ? err.message : "verify failed" };
  }
}

async function resolveUserId(request: Request): Promise<{
  userId: string | null;
  sessionCookie: string | null;
  error?: string;
}> {
  const headerToken = extractTokenFromHeader(request.headers.get("authorization"));
  const cookieToken = getCookieValue(request.headers.get("cookie"), OUTSETA_COOKIE_NAME);
  const token = headerToken || cookieToken;

  if (!token) return { userId: null, sessionCookie: null, error: "Missing access token" };

  const verified = await verifyOutsetaToken(token);
  if (!verified.verified || !verified.payload) {
    return { userId: null, sessionCookie: null, error: "Invalid access token" };
  }

  const payload = verified.payload;
  const userIdFromToken =
    (payload["sub"] as string) ||
    (payload["user_id"] as string) ||
    (payload["uid"] as string) ||
    undefined;

  const accountIdFromToken =
    (payload["outseta:accountUid"] as string) ||
    (payload["outseta:accountuid"] as string) ||
    (payload["account_uid"] as string) ||
    (payload["accountUid"] as string) ||
    (payload["accountId"] as string) ||
    (payload["account_id"] as string) ||
    undefined;

  if (userIdFromToken) {
    return { userId: userIdFromToken, sessionCookie: serializeSessionCookie(userIdFromToken) };
  }
  if (accountIdFromToken) {
    return { userId: accountIdFromToken, sessionCookie: serializeSessionCookie(accountIdFromToken) };
  }
  return { userId: null, sessionCookie: null, error: "No suitable user id in access token" };
}

/* ---------- Workflow selection ---------- */

function pickWorkflow(agent: string | null): string | null {
  const a = agent ?? "business";
  // Prefer server-side envs; fall back to NEXT_PUBLIC_ if needed
  const env = (name: string) => process.env[name] ?? null;

  switch (a) {
    case "business_task1":
      return env("CHATKIT_WORKFLOW_BUSINESS_TASK1") ?? env("NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK1");
    case "business_task2":
      return env("CHATKIT_WORKFLOW_BUSINESS_TASK2") ?? env("NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK2");
    case "business_task3":
      return env("CHATKIT_WORKFLOW_BUSINESS_TASK3") ?? env("NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK3");
    case "product":
      return env("CHATKIT_WORKFLOW_PRODUCT") ?? env("NEXT_PUBLIC_CHATKIT_WORKFLOW_PRODUCT");
    case "marketing":
      return env("CHATKIT_WORKFLOW_MARKETING") ?? env("NEXT_PUBLIC_CHATKIT_WORKFLOW_MARKETING");
    case "finance":
      return env("CHATKIT_WORKFLOW_FINANCE") ?? env("NEXT_PUBLIC_CHATKIT_WORKFLOW_FINANCE");
    case "business":
    default:
      return (
        env("CHATKIT_WORKFLOW_BUSINESS") ??
        env("NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS") ??
        env("NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS_TASK1") // last-resort fallback
      );
  }
}

/* ---------- ChatKit session creation ---------- */

async function createChatKitSession({
  userId,
  agent,
}: {
  userId: string;
  agent: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const workflowId = pickWorkflow(agent);
  if (!workflowId) throw new Error("Missing workflow id for agent");

  const resp = await fetch("https://api.openai.com/v1/chatkit/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      user: { id: userId },
      config: {
        workflow_id: workflowId,
      },
    }),
  });

  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error ?? "Failed to create ChatKit session");
  }
  if (!json.client_secret) {
    throw new Error("Missing client_secret in ChatKit session response");
  }
  return json.client_secret as string;
}

/* ---------- POST handler ---------- */

export async function POST(request: NextRequest) {
  const agent = request.nextUrl.searchParams.get("agent") ?? "business";
  const { userId, sessionCookie, error } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: error ?? "Unable to resolve user from access token" },
      { status: 401 },
    );
  }

  try {
    const clientSecret = await createChatKitSession({ userId, agent });
    const res = NextResponse.json({ client_secret: clientSecret, userId });
    if (sessionCookie) res.headers.set("Set-Cookie", sessionCookie);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create ChatKit session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
