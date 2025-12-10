import { NextRequest, NextResponse } from "next/server";

/* ---------- Constants ---------- */

const OUTSETA_JWKS_URL = "https://second-spring-design.outseta.com/.well-known/jwks";
const OUTSETA_COOKIE_NAME = "outseta_access_token"; // optional
const SESSION_COOKIE_NAME = "chatkit_session_id";

type VerifiedToken = {
  verified: boolean;
  payload?: object;
};

type JwksCache = {
  fetchedAt: number;
  jwks: unknown;
};

const JWKS_TTL = 24 * 60 * 60 * 1000; // 24 hours
let jwksCache: JwksCache | null = null;

/* ---------- Utilities ---------- */

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 2 ? "==" : base64.length % 4 === 3 ? "=" : "";
  const normalized = base64 + pad;

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }

  const binary = atob(normalized);
  const len = binary.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = binary.charCodeAt(i);
  }
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
  const maxAgeSeconds = 60 * 60 * 24 * 365; // 1 year
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    userId,
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function extractTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const parts = headerValue.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return headerValue.trim();
}

/* ---------- Outseta JWT verification ---------- */

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

    return { verified: ok, payload };
  } catch (err) {
    console.warn("verifyOutsetaToken error:", err);
    return { verified: false };
  }
}

/* ---------- Resolve user id from Outseta JWT ---------- */

async function resolveUserId(request: Request): Promise<{
  userId: string | null;
  sessionCookie: string | null;
  error?: string;
}> {
  // Read token from Authorization header
  const headerToken = extractTokenFromHeader(request.headers.get("authorization"));
  const cookieToken = getCookieValue(request.headers.get("cookie"), OUTSETA_COOKIE_NAME);

  const token = headerToken || cookieToken;

  if (!token) {
    console.warn("[create-session] No Outseta access token found in headers or cookies.");
    return { userId: null, sessionCookie: null, error: "Missing access token" };
  }

  try {
    const verified = await verifyOutsetaToken(token);
    if (!verified.verified || !verified.payload) {
      console.warn("[create-session] Outseta token failed verification.");
      return { userId: null, sessionCookie: null, error: "Invalid access token" };
    }

    const payload = verified.payload as Record<string, unknown>;

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

    if (accountIdFromToken) {
      console.log("[create-session] Falling back to account id as userId:", accountIdFromToken);
      return {
        userId: accountIdFromToken,
        sessionCookie: serializeSessionCookie(accountIdFromToken),
      };
    }

    return { userId: null, sessionCookie: null, error: "No suitable user id in access token" };
  } catch (err) {
    console.warn("[create-session] Outseta token verification failed:", err);
    return { userId: null, sessionCookie: null, error: "Error verifying access token" };
  }
}

/* ---------- POST handler ---------- */

export async function POST(request: NextRequest) {
  const { userId, sessionCookie, error } = await resolveUserId(request);

  if (!userId) {
    return NextResponse.json(
      {
        error: error ?? "Unable to resolve user from access token",
      },
      { status: 401 },
    );
  }

  // TODO: plug in your existing ChatKit / Agent Builder session creation logic here.
  // Use `userId` as the stable identifier for history.

  const responseBody = { userId }; // Replace with your real response (client_secret, etc.)
  const res = NextResponse.json(responseBody);

  if (sessionCookie) {
    res.headers.set("Set-Cookie", sessionCookie);
  }

  return res;
}
