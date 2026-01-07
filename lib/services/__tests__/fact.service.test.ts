import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbFact } from '../../types/database';

// Mock the supabase module
vi.mock('../../supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from '../../supabase';
import * as FactService from '../fact.service';

const mockFact: DbFact = {
  id: 'fact-123',
  business_id: 'business-456',
  fact_id: 'business_name',
  fact_text: 'Acme Corp',
  source_workflow: 'onboarding',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('FactService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('should return fact when found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockFact, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getById('fact-123');

      expect(result).toEqual(mockFact);
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

      const result = await FactService.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByFactId', () => {
    it('should return fact by business_id and fact_id', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockFact, error: null }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getByFactId('business-456', 'business_name');

      expect(result).toEqual(mockFact);
    });
  });

  describe('getByBusinessId', () => {
    it('should return all facts for business', async () => {
      const facts = [mockFact, { ...mockFact, id: 'fact-456', fact_id: 'industry' }];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: facts, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getByBusinessId('business-456');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no facts', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getByBusinessId('business-456');

      expect(result).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('should upsert fact with onConflict', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockFact, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.upsert({
        business_id: 'business-456',
        fact_id: 'business_name',
        fact_text: 'Acme Corp',
        source_workflow: 'onboarding',
      });

      expect(result).toEqual(mockFact);
      expect(mockSupabase.from).toHaveBeenCalledWith('facts');
    });

    it('should throw on database error', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      await expect(
        FactService.upsert({
          business_id: 'business-456',
          fact_id: 'test',
          fact_text: 'value',
          source_workflow: null,
        })
      ).rejects.toThrow('Failed to upsert fact');
    });
  });

  describe('deleteByFactId', () => {
    it('should return true when fact deleted', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.deleteByFactId('business-456', 'business_name');

      expect(result).toBe(true);
    });

    it('should return false when fact not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null, count: 0 }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.deleteByFactId('business-456', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should throw on database error', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: { message: 'Database error' },
                count: null,
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      await expect(FactService.deleteByFactId('business-456', 'test')).rejects.toThrow(
        'Failed to delete fact'
      );
    });
  });

  describe('deleteById', () => {
    it('should return true when fact deleted', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.deleteById('fact-123');

      expect(result).toBe(true);
    });
  });
});
