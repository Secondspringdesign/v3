const OUTSETA_ISSUER = "https://second-spring-design.outseta.com";
const OUTSETA_JWKS_URL = "https://second-spring-design.outseta.com/.well-known/jwks";
const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL = 24 * 60 * 60 * 1000;

let jwksCache: { fetchedAt: number; jwks: unknown } | null = null;

async function fetchJwks(): Promise<unknown> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL) return jwksCache.jwks;
  const res = await fetch(OUTSETA_JWKS_URL);
  const json = await res.json();
  jwksCache = { fetchedAt: Date.now(), jwks: json };
  return json;
}

function base64UrlToUint8Array(input: string): Uint8Array {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

function parseJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  return {
    header: JSON.parse(atob(parts[0])) as Record<string, unknown>,
    payload: JSON.parse(atob(parts[1])) as Record<string, unknown>,
    signatureB64: parts[2],
    signingInput: `${parts[0]}.${parts[1]}`,
  };
}

async function getJwkForKid(jwksUrl: string, kid?: string) {
  const jwks = (await fetchJwks()) as { keys?: Array<Record<string, unknown>> };
  const keys = jwks?.keys ?? [];
  return keys.find((k) => (k as { kid?: string }).kid === kid) ?? null;
}

export async function verifyOutsetaToken(token: string): Promise<{ verified: boolean; payload?: Record<string, unknown> }> {
  const { header, payload, signatureB64, signingInput } = parseJwt(token);
  const jwk = await getJwkForKid(OUTSETA_JWKS_URL, typeof header.kid === "string" ? header.kid : undefined);
  if (!jwk) return { verified: false, payload };

  const sigArray = base64UrlToUint8Array(signatureB64);
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    sigArray as unknown as BufferSource,
    new TextEncoder().encode(signingInput) as unknown as BufferSource
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
