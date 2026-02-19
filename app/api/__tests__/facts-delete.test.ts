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
    deleteByFactId: vi.fn(),
  },
}));

import { authenticateRequest } from '@/lib/auth/middleware';
import { UserService, BusinessService, FactService } from '@/lib/services';
import { DELETE } from '../facts/[factId]/route';

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

describe('DELETE /api/facts/:factId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: false,
      error: 'Missing authentication token',
      status: 401,
    });

    const request = new Request('http://localhost/api/facts/business_name', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ factId: 'business_name' }) });

    expect(response.status).toBe(401);
  });

  it('should return 404 when user does not exist', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-new' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(null);

    const request = new Request('http://localhost/api/facts/business_name', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ factId: 'business_name' }) });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Fact not found');
  });

  it('should return 404 when business does not exist', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(null);

    const request = new Request('http://localhost/api/facts/business_name', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ factId: 'business_name' }) });

    expect(response.status).toBe(404);
  });

  it('should return 404 when fact does not exist', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(mockBusiness);
    vi.mocked(FactService.deleteByFactId).mockResolvedValue(false);

    const request = new Request('http://localhost/api/facts/nonexistent', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ factId: 'nonexistent' }) });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Fact not found');
  });

  it('should delete fact and return success', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(mockBusiness);
    vi.mocked(FactService.deleteByFactId).mockResolvedValue(true);

    const request = new Request('http://localhost/api/facts/business_name', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ factId: 'business_name' }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.deleted).toBe('business_name');
  });

  it('should only delete facts belonging to authenticated user', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      success: true,
      context: { outsetaUid: 'outseta-abc' },
    });
    vi.mocked(UserService.getByOutsetaUid).mockResolvedValue(mockUser);
    vi.mocked(BusinessService.getActiveByUserId).mockResolvedValue(mockBusiness);
    vi.mocked(FactService.deleteByFactId).mockResolvedValue(true);

    const request = new Request('http://localhost/api/facts/my_fact', {
      method: 'DELETE',
    });

    await DELETE(request, { params: Promise.resolve({ factId: 'my_fact' }) });

    // Verify deleteByFactId was called with the user's business ID
    expect(FactService.deleteByFactId).toHaveBeenCalledWith('business-456', 'my_fact');
  });
});
