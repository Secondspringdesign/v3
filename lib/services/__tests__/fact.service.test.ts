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
  fact_value: 'Acme Corp',
  source_workflow: 'onboarding',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  fact_type_id: null,
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
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockFact, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getByFactId('business-456', 'business_name');

      expect(result).toEqual(mockFact);
    });

    it('should return null when not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getByFactId('business-456', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should handle multiple rows by returning the most recent', async () => {
      const recentFact = { ...mockFact, updated_at: '2024-01-02T00:00:00Z' };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: recentFact, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getByFactId('business-456', 'business_name');

      expect(result).toEqual(recentFact);
    });
  });

  describe('getByFactTypeId', () => {
    it('should return fact by business_id and fact_type_id', async () => {
      const factWithType = { ...mockFact, fact_type_id: 'type-123' };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: factWithType, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getByFactTypeId('business-456', 'type-123');

      expect(result).toEqual(factWithType);
    });

    it('should return null when not found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getByFactTypeId('business-456', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should handle multiple rows by returning the most recent', async () => {
      const recentFact = { ...mockFact, fact_type_id: 'type-123', updated_at: '2024-01-02T00:00:00Z' };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: recentFact, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.getByFactTypeId('business-456', 'type-123');

      expect(result).toEqual(recentFact);
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
    it('should insert new fact when fact_type_id is provided and fact does not exist', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
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
        fact_value: 'Acme Corp',
        source_workflow: 'onboarding',
        fact_type_id: 'type-123',
      });

      expect(result).toEqual(mockFact);
      expect(mockSupabase.from).toHaveBeenCalledWith('facts');
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    it('should update existing fact when fact_type_id is provided and fact exists', async () => {
      const existingFact = { ...mockFact, fact_value: 'Old Corp', fact_type_id: 'type-123' };
      const updatedFact = { ...mockFact, fact_value: 'New Corp', fact_type_id: 'type-123' };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: existingFact, error: null }),
                  }),
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedFact, error: null }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.upsert({
        business_id: 'business-456',
        fact_id: 'business_name',
        fact_value: 'New Corp',
        source_workflow: 'onboarding',
        fact_type_id: 'type-123',
      });

      expect(result).toEqual(updatedFact);
      expect(mockSupabase.from).toHaveBeenCalledWith('facts');
      expect(mockSupabase.from().update).toHaveBeenCalled();
    });

    it('should insert new fact when fact_type_id is null and fact does not exist', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockFact, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.upsert({
        business_id: 'business-456',
        fact_id: 'new_fact',
        fact_value: 'New Value',
        source_workflow: null,
        fact_type_id: null,
      });

      expect(result).toEqual(mockFact);
      expect(mockSupabase.from).toHaveBeenCalledWith('facts');
    });

    it('should update existing fact when fact_type_id is null and fact exists', async () => {
      const existingFact = { ...mockFact, fact_value: 'Old Value' };
      const updatedFact = { ...mockFact, fact_value: 'New Value' };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: existingFact, error: null }),
                  }),
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedFact, error: null }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await FactService.upsert({
        business_id: 'business-456',
        fact_id: 'business_name',
        fact_value: 'New Value',
        source_workflow: null,
        fact_type_id: null,
      });

      expect(result).toEqual(updatedFact);
      expect(mockSupabase.from).toHaveBeenCalledWith('facts');
    });

    it('should throw on database error', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
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
          fact_value: 'value',
          source_workflow: null,
          fact_type_id: 'type-123',
        })
      ).rejects.toThrow('Failed to insert fact');
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
