import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbBusiness } from '../../types/database';

// Mock the supabase module
vi.mock('../../supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from '../../supabase';
import * as BusinessService from '../business.service';

const mockBusiness: DbBusiness = {
  id: 'business-123',
  user_id: 'user-456',
  name: 'Test Business',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('BusinessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('should return business when found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockBusiness, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await BusinessService.getById('business-123');

      expect(result).toEqual(mockBusiness);
    });

    it('should return null when not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows' },
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await BusinessService.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByUserId', () => {
    it('should return all businesses for user', async () => {
      const businesses = [mockBusiness, { ...mockBusiness, id: 'business-456' }];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: businesses, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await BusinessService.getByUserId('user-456');

      expect(result).toHaveLength(2);
    });

    it('should filter by status when provided', async () => {
      // The query chain is: select().eq(user_id).order() then .eq(status) after
      // But the code does: query = query.eq('status', status) after order
      const orderMock = vi.fn().mockReturnThis();
      const eqChain = {
        order: orderMock,
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) => resolve({ data: [mockBusiness], error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(eqChain),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await BusinessService.getByUserId('user-456', 'active');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
    });
  });

  describe('getActiveByUserId', () => {
    it('should return first active business', async () => {
      const eqChain = {
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) => resolve({ data: [mockBusiness], error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(eqChain),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await BusinessService.getActiveByUserId('user-456');

      expect(result).toEqual(mockBusiness);
    });

    it('should return null when no active business', async () => {
      const eqChain = {
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(eqChain),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await BusinessService.getActiveByUserId('user-456');

      expect(result).toBeNull();
    });
  });

  describe('getOrCreateActive', () => {
    it('should return existing active business', async () => {
      const eqChain = {
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) => resolve({ data: [mockBusiness], error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(eqChain),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await BusinessService.getOrCreateActive('user-456');

      expect(result).toEqual(mockBusiness);
    });

    it('should create new business when none exists', async () => {
      const newBusiness = { ...mockBusiness, id: 'new-business' };

      const eqChain = {
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(eqChain),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: newBusiness, error: null }),
            }),
          }),
        })),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await BusinessService.getOrCreateActive('user-456');

      expect(result).toEqual(newBusiness);
    });
  });

  describe('archive', () => {
    it('should update status to archived', async () => {
      const archivedBusiness = { ...mockBusiness, status: 'archived' as const };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: archivedBusiness, error: null }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await BusinessService.archive('business-123');

      expect(result.status).toBe('archived');
    });
  });
});
