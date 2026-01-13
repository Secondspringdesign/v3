/**
 * JWT verification for Outseta tokens
 *
 * Extracted from app/api/create-session/route.ts for reuse across API routes.
 * Uses RS256 with JWKS for signature verification.
 */

// ============================================
// CONSTANTS
// ============================================

const OUTSETA_ISSUER = 'https://second-spring-design.outseta.com';
const OUTSETA_JWKS_URL = 'https://second-spring-design.outseta.com/.well-known/jwks';
const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ============================================
// JWKS CACHE
// ============================================

// Extended JsonWebKey with kid (key ID) property from JWKS
interface JwkWithKid extends JsonWebKey {
  kid?: string;
}

interface JwksCache {
  fetchedAt: number;
  jwks: { keys: JwkWithKid[] };
}

let jwksCache: JwksCache | null = null;

// ============================================
// BASE64 UTILITIES
// ============================================

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 2 ? '==' : base64.length % 4 === 3 ? '=' : '';
  const normalized = base64 + pad;

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }

  const binary = atob(normalized);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

function base64UrlDecode(input: string): string {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  const raw = atob(str);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    arr[i] = raw.charCodeAt(i);
  }
  return new TextDecoder().decode(arr);
}

// ============================================
// JWT PARSING
// ============================================

export interface JwtHeader {
  alg: string;
  typ?: string;
  kid?: string;
}

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  // Outseta-specific claims
  'outseta:accountUid'?: string;
  'outseta:accountuid'?: string;
  account_uid?: string;
  accountUid?: string;
  accountId?: string;
  account_id?: string;
  user_id?: string;
  uid?: string;
  email?: string;
  [key: string]: unknown;
}

interface ParsedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  signatureB64: string;
  signingInput: string;
}

export function parseJwt(token: string): ParsedJwt {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  return {
    header: JSON.parse(base64UrlDecode(parts[0])) as JwtHeader,
    payload: JSON.parse(base64UrlDecode(parts[1])) as JwtPayload,
    signatureB64: parts[2],
    signingInput: `${parts[0]}.${parts[1]}`,
  };
}

// ============================================
// JWKS FETCHING
// ============================================

async function getJwkForKid(kid?: string): Promise<JwkWithKid | null> {
  try {
    const now = Date.now();
    if (!jwksCache || now - jwksCache.fetchedAt > JWKS_TTL) {
      const res = await fetch(OUTSETA_JWKS_URL);
      if (!res.ok) {
        throw new Error(`Failed to fetch JWKS (${res.status})`);
      }
      const jwks = await res.json();
      jwksCache = { fetchedAt: now, jwks };
    }

    const keys = jwksCache.jwks.keys ?? [];
    if (!kid) {
      return keys.find((k) => k.kty === 'RSA') ?? null;
    }
    return keys.find((k) => k.kid === kid) ?? null;
  } catch (err) {
    console.warn('Error fetching JWKS:', err);
    return null;
  }
}

// ============================================
// TOKEN VERIFICATION
// ============================================

export interface VerificationResult {
  verified: boolean;
  payload?: JwtPayload;
  error?: string;
}

/**
 * Verify an Outseta JWT token using RS256 and JWKS
 *
 * @param token - The JWT token string
 * @returns Verification result with payload if successful
 */
export async function verifyOutsetaToken(token: string): Promise<VerificationResult> {
  try {
    const { header, payload, signatureB64, signingInput } = parseJwt(token);

    // Fetch the matching JWK
    const jwk = await getJwkForKid(header.kid);
    if (!jwk) {
      return { verified: false, payload, error: 'No matching JWK found' };
    }

    // Verify signature
    const sigArray = base64UrlToUint8Array(signatureB64);
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // TypeScript strict mode requires casting Uint8Array for crypto.subtle.verify
    const signatureValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      sigArray as unknown as ArrayBuffer,
      new TextEncoder().encode(signingInput)
    );

    if (!signatureValid) {
      return { verified: false, payload, error: 'Invalid signature' };
    }

    // Validate claims
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.exp === 'number' && payload.exp < now - CLOCK_SKEW_SECONDS) {
      return { verified: false, payload, error: 'Token expired' };
    }

    if (typeof payload.nbf === 'number' && payload.nbf > now + CLOCK_SKEW_SECONDS) {
      return { verified: false, payload, error: 'Token not yet valid' };
    }

    if (payload.iss && payload.iss !== OUTSETA_ISSUER) {
      return { verified: false, payload, error: 'Invalid issuer' };
    }

    return { verified: true, payload };
  } catch (err) {
    return { verified: false, error: String(err) };
  }
}

// ============================================
// UTILITY HELPERS
// ============================================

/**
 * Extract the Outseta user ID from a verified JWT payload
 *
 * Checks multiple possible claim names used by Outseta.
 *
 * @param payload - The verified JWT payload
 * @returns The user ID or null if not found
 */
export function extractOutsetaUid(payload: JwtPayload): string | null {
  // Check all possible Outseta claim names
  const uid =
    payload['outseta:accountUid'] ||
    payload['outseta:accountuid'] ||
    payload.account_uid ||
    payload.accountUid ||
    payload.accountId ||
    payload.account_id ||
    payload.sub ||
    payload.user_id ||
    payload.uid;

  return typeof uid === 'string' ? uid : null;
}

/**
 * Extract email from a verified JWT payload
 *
 * @param payload - The verified JWT payload
 * @returns The email or null if not found
 */
export function extractEmail(payload: JwtPayload): string | null {
  const email = payload.email;
  return typeof email === 'string' ? email : null;
}

/**
 * Extract a token from Authorization header
 *
 * Supports "Bearer <token>" format or raw token.
 *
 * @param headerValue - The Authorization header value
 * @returns The token or null
 */
export function extractTokenFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const parts = headerValue.trim().split(/\s+/);
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

/**
 * Get a cookie value by name
 *
 * @param cookieHeader - The Cookie header string
 * @param name - The cookie name
 * @returns The cookie value or null
 */
export function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split('=');
    if (rawName?.trim() === name) {
      return rest.join('=').trim();
    }
  }
  return null;
}

/** Cookie name for Outseta access token */
export const OUTSETA_COOKIE_NAME = 'outseta_access_token';
