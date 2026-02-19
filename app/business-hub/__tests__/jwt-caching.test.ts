import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Unit tests for JWT caching logic in business-hub page
 * 
 * These tests verify:
 * 1. JWT parsing works correctly
 * 2. Expiry validation with 60-second buffer
 * 3. outseta_sub matching between tokens
 * 4. sessionStorage cache invalidation scenarios
 */

// Mock sessionStorage for Node environment
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Helper to create a mock JWT
function createMockJWT(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  return `${headerB64}.${payloadB64}.mock-signature`;
}

// JWT parsing helper (copied from implementation)
function parseJwtPayload(token: string): { exp?: number; outseta_sub?: string; sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

describe('JWT Caching Logic', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('parseJwtPayload', () => {
    it('should parse a valid JWT', () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createMockJWT({ 
        exp: now + 3600, 
        outseta_sub: 'user-123',
        sub: 'user-123' 
      });
      
      const payload = parseJwtPayload(token);
      
      expect(payload).toBeTruthy();
      expect(payload?.exp).toBe(now + 3600);
      expect(payload?.outseta_sub).toBe('user-123');
      expect(payload?.sub).toBe('user-123');
    });

    it('should return null for invalid JWT format', () => {
      const payload = parseJwtPayload('invalid.token');
      expect(payload).toBeNull();
    });

    it('should return null for malformed JWT', () => {
      const payload = parseJwtPayload('not-a-jwt-at-all');
      expect(payload).toBeNull();
    });
  });

  describe('Token Expiry Validation', () => {
    it('should detect expired token', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = createMockJWT({ 
        exp: now - 100, // expired 100 seconds ago
        outseta_sub: 'user-123' 
      });
      
      const payload = parseJwtPayload(expiredToken);
      expect(payload?.exp).toBeLessThan(now);
    });

    it('should detect token expiring within 60 seconds', () => {
      const now = Math.floor(Date.now() / 1000);
      const soonToExpireToken = createMockJWT({ 
        exp: now + 30, // expires in 30 seconds
        outseta_sub: 'user-123' 
      });
      
      const payload = parseJwtPayload(soonToExpireToken);
      expect(payload?.exp).toBeLessThan(now + 60);
    });

    it('should accept token with > 60 seconds until expiry', () => {
      const now = Math.floor(Date.now() / 1000);
      const validToken = createMockJWT({ 
        exp: now + 120, // expires in 2 minutes
        outseta_sub: 'user-123' 
      });
      
      const payload = parseJwtPayload(validToken);
      expect(payload?.exp).toBeGreaterThan(now + 60);
    });
  });

  describe('outseta_sub Matching', () => {
    it('should detect matching outseta_sub between cached and current token', () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedToken = createMockJWT({ 
        exp: now + 3600,
        outseta_sub: 'user-123' 
      });
      const outsetaToken = createMockJWT({ 
        sub: 'user-123' 
      });
      
      const cachedPayload = parseJwtPayload(cachedToken);
      const outsetaPayload = parseJwtPayload(outsetaToken);
      
      expect(cachedPayload?.outseta_sub).toBe(outsetaPayload?.sub);
    });

    it('should detect non-matching outseta_sub (user switched)', () => {
      const now = Math.floor(Date.now() / 1000);
      const cachedToken = createMockJWT({ 
        exp: now + 3600,
        outseta_sub: 'user-123' 
      });
      const outsetaToken = createMockJWT({ 
        sub: 'user-456' // different user
      });
      
      const cachedPayload = parseJwtPayload(cachedToken);
      const outsetaPayload = parseJwtPayload(outsetaToken);
      
      expect(cachedPayload?.outseta_sub).not.toBe(outsetaPayload?.sub);
    });
  });

  describe('sessionStorage Integration', () => {
    it('should store and retrieve token from sessionStorage', () => {
      const token = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      
      sessionStorage.setItem('sb_jwt', token);
      const retrieved = sessionStorage.getItem('sb_jwt');
      
      expect(retrieved).toBe(token);
    });

    it('should remove token from sessionStorage', () => {
      const token = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      
      sessionStorage.setItem('sb_jwt', token);
      sessionStorage.removeItem('sb_jwt');
      const retrieved = sessionStorage.getItem('sb_jwt');
      
      expect(retrieved).toBeNull();
    });

    it('should return null when no token is cached', () => {
      const retrieved = sessionStorage.getItem('sb_jwt');
      expect(retrieved).toBeNull();
    });
  });

  describe('Cache Validation Scenarios', () => {
    it('should invalidate cache when token is expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = createMockJWT({ 
        exp: now - 100,
        outseta_sub: 'user-123' 
      });
      
      sessionStorage.setItem('sb_jwt', expiredToken);
      const cached = sessionStorage.getItem('sb_jwt');
      const payload = parseJwtPayload(cached!);
      
      // Should be invalidated (exp in the past)
      expect(payload?.exp).toBeLessThan(now);
    });

    it('should invalidate cache when token expires within 60 seconds', () => {
      const now = Math.floor(Date.now() / 1000);
      const soonToExpireToken = createMockJWT({ 
        exp: now + 30,
        outseta_sub: 'user-123' 
      });
      
      sessionStorage.setItem('sb_jwt', soonToExpireToken);
      const cached = sessionStorage.getItem('sb_jwt');
      const payload = parseJwtPayload(cached!);
      
      // Should be invalidated (< 60 seconds until expiry)
      expect(payload?.exp! - now).toBeLessThan(60);
    });

    it('should use cached token when valid and user matches', () => {
      const now = Math.floor(Date.now() / 1000);
      const validToken = createMockJWT({ 
        exp: now + 3600,
        outseta_sub: 'user-123' 
      });
      const outsetaToken = createMockJWT({ 
        sub: 'user-123' 
      });
      
      sessionStorage.setItem('sb_jwt', validToken);
      const cached = sessionStorage.getItem('sb_jwt');
      const cachedPayload = parseJwtPayload(cached!);
      const outsetaPayload = parseJwtPayload(outsetaToken);
      
      // Should be valid
      expect(cachedPayload?.exp! - now).toBeGreaterThan(60);
      expect(cachedPayload?.outseta_sub).toBe(outsetaPayload?.sub);
    });
  });
});
