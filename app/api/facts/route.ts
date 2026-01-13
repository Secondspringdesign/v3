import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------- Outseta verify (RS256 via JWKS) ----------
const OUTSETA_ISSUER = process.env.OUTSETA_ISSUER || "https://second-spring-design.outseta.com";
const OUTSETA_JWKS_URL = process.env.OUTSETA_JWKS_URL || "https://second-spring-design.outseta.com/.well-known/jwks";
const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL = 24 * 60 * 60 * 1000;
let jwksCache: { fetchedAt: number; jwks: any[] } | null = null;

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  if (typeof Buffer !== "undefined") return Buffer.from(normalized, "base64").toString("utf-8");
  const binary = atob(normalized);
  return binary;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const decoded = base64UrlDecode(base64Url);
  const arr = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) arr[i] = decoded.charCodeAt(i);
  return arr;
}

function parseJwt(token: string) {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) throw new Error("Invalid JWT");
  return {
    header: JSON.parse(base64UrlDecode(headerB64)),
    payload: JSON.parse(base64UrlDecode(payloadB64)),
    signatureB64,
    signingInput: `${headerB64}.${payloadB64}`,
  };
}

async function fetchJwks(jwksUrl: string) {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL) return jwksCache.jwks;
  const res = await fetch(jwksUrl);
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
  const json = (await res.json()) as { keys: any[] };
  if (!json.keys || !Array.isArray(json.keys)) throw new Error("Invalid JWKS payload");
  jwksCache = { fetchedAt: Date.now(), jwks: json.keys };
  return jwksCache.jwks;
}

async function getJwkForKid(jwksUrl: string, kid?: string): Promise<any | null> {
  const jwks = await fetchJwks(jwksUrl);
  if (kid) return jwks.find((k) => k.kid === kid) ?? null;
  return jwks[0] ?? null;
}

async function verifyOutsetaToken(token: string): Promise<{ verified: boolean; payload?: any }> {
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
    sigArray as BufferSource,
    new TextEncoder().encode(signingInput) as BufferSource,
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

// ---------- Supabase ----------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env vars");

function createServiceClient(): SupabaseClient {
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveBusinessId(sub: string, supabase: SupabaseClient) {
  const { data: userRow, error: userErr } = await supabase.from("users").select("id").eq("outseta_uid", sub).maybeSingle();
  if (userErr) throw userErr;
  let ensuredUser = userRow;
  if (!ensuredUser) {
    const { data, error } = await supabase.from("users").insert({ outseta_uid: sub }).select("id").single();
    if (error) throw error;
    ensuredUser = data;
  }
  const { data: bizRow, error: bizErr } = await supabase.from("businesses").select("id").eq("user_id", ensuredUser.id).maybeSingle();
  if (bizErr) throw bizErr;
  let ensuredBiz = bizRow;
  if (!ensuredBiz) {
    const { data, error } = await supabase.from("businesses").insert({ user_id: ensuredUser.id, name: "Default" }).select("id").single();
    if (error) throw error;
    ensuredBiz = data;
  }
  return ensuredBiz.id as string;
}

function extractBearer(request: Request): string | null {
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// ---------- Handlers ----------
export async function GET(request: Request) {
  try {
    const token = extractBearer(request);
    if (!token) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });

    const verified = await verifyOutsetaToken(token);
    if (!verified?.verified || !verified.payload?.sub) {
      console.error("verifyOutsetaToken failed (GET)", { verified: verified?.verified, payload: verified?.payload });
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const businessId = await resolveBusinessId(verified.payload.sub, supabase);

    const { data, error } = await supabase
      .from("facts")
      .select("id, fact_id, fact_text, source_workflow, created_at, updated_at")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, facts: data ?? [] });
  } catch (e) {
    console.error("/api/facts GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = extractBearer(request);
    if (!token) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });

    const verified = await verifyOutsetaToken(token);
    if (!verified?.verified || !verified.payload?.sub) {
      console.error("verifyOutsetaToken failed (POST)", { verified: verified?.verified, payload: verified?.payload });
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const fact_id = typeof body?.fact_id === "string" ? body.fact_id.trim() : "";
    const fact_text = typeof body?.fact_text === "string" ? body.fact_text.trim() : "";
    const source_workflow = typeof body?.source_workflow === "string" ? body.source_workflow.trim() : null;
    if (!fact_id || !fact_text) return NextResponse.json({ error: "fact_id and fact_text are required" }, { status: 400 });

    const supabase = createServiceClient();
    const businessId = await resolveBusinessId(verified.payload.sub, supabase);

    const { data, error } = await supabase
      .from("facts")
      .upsert({ business_id: businessId, fact_id, fact_text, source_workflow }, { onConflict: "business_id,fact_id" })
      .select("id, fact_id, fact_text, source_workflow, created_at, updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, fact: data });
  } catch (e) {
    console.error("/api/facts POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
