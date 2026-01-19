import { NextRequest, NextResponse } from "next/server";

const OUTSETA_ISSUER = "https://second-spring-design.outseta.com";
const OUTSETA_JWKS_URL = "https://second-spring-design.outseta.com/.well-known/jwks";
const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL = 24 * 60 * 60 * 1000;
let jwksCache: { fetchedAt: number; jwks: unknown } | null = null;

export async function POST(req: NextRequest) {
  try {
    const bearer = req.headers.get("authorization");
    const token = extractTokenFromHeader(bearer);
    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });

    const verified = await verifyOutsetaToken(token);
    if (!verified?.verified || !verified.payload) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    const payload = verified.payload as Record<string, unknown>;
    const outsetaSub =
      (payload["sub"] as string) ||
      (payload["user_id"] as string) ||
      (payload["uid"] as string) ||
      undefined;
    if (!outsetaSub) {
      return NextResponse.json({ error: "Missing sub" }, { status: 401 });
    }

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRole) {
      return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
    }

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
      const text = await res.text();
      return NextResponse.json({ error: "Failed to fetch facts", detail: text }, { status: 502 });
    }

    const rows = (await res.json()) as Array<{
      fact_id: string;
      fact_text: string;
      source_workflow?: string | null;
      updated_at?: string | null;
    }>;

    const summary = rows.slice(0, 30).map((r) => {
      const src = r.source_workflow ? ` (source: ${r.source_workflow})` : "";
      return `- ${r.fact_id}: ${r.fact_text}${src}`;
    }).join("\n");

    return NextResponse.json({ facts: rows, summary }, { status: 200 });
  } catch (err) {
    console.error("get-facts error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ---------- Outseta verification helpers ---------- */
function extractTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const parts = headerValue.trim().split(/\s+/);
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

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

function base64UrlDecode(input: string): string {
  let str = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  const raw = atob(str);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return new TextDecoder().decode(arr);
}
