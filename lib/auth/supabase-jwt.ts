import { SignJWT } from "jose";

const DEFAULT_ISSUER = "supabase";
const DEFAULT_AUDIENCE = "authenticated";
// Was 1 hour; use 4 hours to reduce mid-session drops.
const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 4;

function getJwtSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("Missing SUPABASE_JWT_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export async function createSupabaseAccessToken(params: {
  outsetaSub: string;
  email?: string;
  expiresInSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = params.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
  const issuer = process.env.SUPABASE_JWT_ISSUER ?? DEFAULT_ISSUER;
  const audience = process.env.SUPABASE_JWT_AUDIENCE ?? DEFAULT_AUDIENCE;

  const token = await new SignJWT({
    role: "authenticated",
    outseta_sub: params.outsetaSub,
    email: params.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.outsetaSub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(getJwtSecret());

  return {
    accessToken: token,
    expiresIn,
    expiresAt: now + expiresIn,
  };
}
