import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth middleware
vi.mock('@/lib/auth/middleware', () => ({
  authenticateRequest: vi.fn(),
  errorResponse: vi.fn((error: string, status: number, code?: string) => {
    return new Response(JSON.stringify({ error, code }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  jsonResponse: vi.fn((data: unknown, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
}));

// Mock the services
vi.mock('@/lib/services', () => ({
  UserService: {
    getOrCreate: vi.fn(),
    getByOutsetaUid: vi.fn(),
  },
  BusinessService: {
    getOrCreateActive: vi.fn(),
    getActiveByUserId: vi.fn(),
  },
  FactService: {
    upsert: vi.fn(),
    getByBusinessId: vi.fn(),
    deleteByFactId: vi.fn(),
  },
}));

import { authenticateRequest } from '@/lib/auth/middleware';
import { UserService, BusinessService, FactService } from '@/lib/services';
import { POST, GET } from '../facts/route';

const mockUser = {
  id: 'user-123',
  outseta_uid: 'outseta-abc',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockBusiness = {
  id: 'business-456',
  user_id: 'user-123',
  name: 'Test Business',
  status: 'active' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockFact = {
  id: 'fact-789',
  business_id: 'business-456',
  fact_id: 'business_name',
  fact_text: 'Acme Corp',
  source_workflow: 'onboarding',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('POST /api/facts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: false,
      error: 'Missing authentication token',
      status: 401,
    });

    const request = new Request('http://localhost/api/facts', {
      method: 'POST',
      body: JSON.stringify({ fact_id: 'test', fact_text: 'value' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Missing authentication token');
  });

  it('should return 400 for invalid JSON body', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc', email: 'test@example.com' },
    });

    const request = new Request('http://localhost/api/facts', {
      method: 'POST',
      body: 'not json',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid JSON body');
  });

  it('should return 400 when fact_id is missing', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc', email: 'test@example.com' },
    });

    const request = new Request('http://localhost/api/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact_text: 'value' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('fact_id');
  });

  it('should return 400 when fact_text is missing', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc', email: 'test@example.com' },
    });

    const request = new Request('http://localhost/api/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact_id: 'test' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('fact_text');
  });

  it('should create fact and return 201 on success', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc', email: 'test@example.com' },
    });
    vi.mocked(UserService.getOrCreate).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getOrCreateActive).mockResolvedValue(mockBusiness);
    vi.mocked(FactService.upsert).mockResolvedValue(mockFact);

    const request = new Request('http://localhost/api/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fact_id: 'business_name',
        fact_text: 'Acme Corp',
        source_workflow: 'onboarding',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.fact.fact_id).toBe('business_name');
    expect(body.fact.fact_text).toBe('Acme Corp');
  });

  it('should auto-create user and business', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-new', email: 'new@example.com' },
    });
    vi.mocked(UserService.getOrCreate).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getOrCreateActive).mockResolvedValue(mockBusiness);
    vi.mocked(FactService.upsert).mockResolvedValue(mockFact);

    const request = new Request('http://localhost/api/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact_id: 'test', fact_text: 'value' }),
    });

    await POST(request);

    expect(UserService.getOrCreate).toHaveBeenCalledWith('outseta-new', 'new@example.com');
    expect(BusinessService.getOrCreateActive).toHaveBeenCalledWith(mockUser.id);
  });
});

describe('GET /api/facts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: false,
      error: 'Missing authentication token',
      status: 401,
    });

    const request = new Request('http://localhost/api/facts');

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return empty array for new user', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-new' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(null);

    const request = new Request('http://localhost/api/facts');

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.facts).toEqual([]);
  });

  it('should return empty array when user has no business', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(null);

    const request = new Request('http://localhost/api/facts');

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.facts).toEqual([]);
  });

  it('should return facts for authenticated user', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(mockBusiness);
    vi.mocked(FactService.getByBusinessId).mockResolvedValue([mockFact]);

    const request = new Request('http://localhost/api/facts');

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.facts).toHaveLength(1);
    expect(body.facts[0].fact_id).toBe('business_name');
  });

  it('should isolate facts by user (user A cannot see user B facts)', async () => {
    const userA = { ...mockUser, id: 'user-A', outseta_uid: 'outseta-A' };
    const userB = { ...mockUser, id: 'user-B', outseta_uid: 'outseta-B' };
    const businessA = { ...mockBusiness, id: 'business-A', user_id: 'user-A' };
    const factA = { ...mockFact, business_id: 'business-A', fact_text: 'User A Business' };

    // User A's request
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-A' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(userA);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(businessA);
    vi.mocked(FactService.getByBusinessId).mockResolvedValue([factA]);

    const requestA = new Request('http://localhost/api/facts');
    const responseA = await GET(requestA);
    const bodyA = await responseA.json();

    expect(bodyA.facts[0].fact_text).toBe('User A Business');

    // User B's request - should NOT see User A's facts
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-B' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(userB);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(null); // User B has no business

    const requestB = new Request('http://localhost/api/facts');
    const responseB = await GET(requestB);
    const bodyB = await responseB.json();

    expect(bodyB.facts).toEqual([]);
  });
});
