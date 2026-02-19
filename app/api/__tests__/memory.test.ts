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
    getByOutsetaUid: vi.fn(),
  },
  BusinessService: {
    getActiveByUserId: vi.fn(),
  },
  FactService: {
    getByBusinessId: vi.fn(),
  },
  MemoryService: {
    formatForAI: vi.fn(),
  },
}));

import { authenticateRequest } from '@/lib/auth/middleware';
import { UserService, BusinessService, FactService, MemoryService } from '@/lib/services';
import { GET } from '../memory/route';

const mockUser = {
  id: 'user-123',
  outseta_uid: 'outseta-abc',
  account_uid: null,
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

const mockFacts = [
  {
    id: 'fact-1',
    business_id: 'business-456',
    fact_id: 'business_name',
    fact_text: 'Acme Corp',
    source_workflow: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'fact-2',
    business_id: 'business-456',
    fact_id: 'industry',
    fact_text: 'Technology',
    source_workflow: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('GET /api/memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: false,
      error: 'Missing authentication token',
      status: 401,
    });

    const request = new Request('http://localhost/api/memory');

    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Missing authentication token');
  });

  it('should return empty memory_context for new user', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-new' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(null);

    const request = new Request('http://localhost/api/memory');

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.memory_context).toBe('');
  });

  it('should return empty memory_context when user has no business', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(null);

    const request = new Request('http://localhost/api/memory');

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.memory_context).toBe('');
  });

  it('should return formatted memory for authenticated user', async () => {
    const formattedMemory = `## Business Memory

**Business Name**: Acme Corp

**Industry**: Technology`;

    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(mockBusiness);
    vi.mocked(FactService.getByBusinessId).mockResolvedValue(mockFacts);
    vi.mocked(MemoryService.formatForAI).mockReturnValue(formattedMemory);

    const request = new Request('http://localhost/api/memory');

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.memory_context).toBe(formattedMemory);
    expect(body.memory_context).toContain('Business Name');
    expect(body.memory_context).toContain('Acme Corp');
  });

  it('should call MemoryService.formatForAI with facts', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(mockBusiness);
    vi.mocked(FactService.getByBusinessId).mockResolvedValue(mockFacts);
    vi.mocked(MemoryService.formatForAI).mockReturnValue('formatted');

    const request = new Request('http://localhost/api/memory');

    await GET(request);

    expect(MemoryService.formatForAI).toHaveBeenCalledWith(mockFacts);
  });

  it('should isolate memory by user', async () => {
    const userA = { ...mockUser, id: 'user-A', outseta_uid: 'outseta-A' };
    const businessA = { ...mockBusiness, id: 'business-A', user_id: 'user-A' };

    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-A' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(userA);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(businessA);
    vi.mocked(FactService.getByBusinessId).mockResolvedValue([]);
    vi.mocked(MemoryService.formatForAI).mockReturnValue('');

    const request = new Request('http://localhost/api/memory');

    await GET(request);

    // Verify getByBusinessId was called with user A's business
    expect(FactService.getByBusinessId).toHaveBeenCalledWith('business-A');
  });
});
