import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbUser } from '../../types/database';

// Mock the supabase module
vi.mock('../../supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from '../../supabase';
import * as UserService from '../user.service';

const mockUser: DbUser = {
  id: 'user-123',
  outseta_uid: 'outseta-abc',
  account_uid: null,
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByOutsetaUid', () => {
    it('should return user when found', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await UserService.getByOutsetaUid('outseta-abc');

      expect(result).toEqual(mockUser);
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('should return null when user not found', async () => {
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

      const result = await UserService.getByOutsetaUid('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on database error', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'OTHER', message: 'Database error' },
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      await expect(UserService.getByOutsetaUid('test')).rejects.toThrow('Failed to fetch user');
    });
  });

  describe('getOrCreate', () => {
    it('should return existing user without update when email unchanged', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await UserService.getOrCreate('outseta-abc', 'test@example.com');

      expect(result).toEqual(mockUser);
    });

    it('should update email when different', async () => {
      const updatedUser = { ...mockUser, email: 'new@example.com' };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
              }),
            }),
          }),
        }),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await UserService.getOrCreate('outseta-abc', 'new@example.com');

      expect(result.email).toBe('new@example.com');
    });

    it('should create new user when not found', async () => {
      const newUser = { ...mockUser, id: 'new-user-id' };

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows' },
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: newUser, error: null }),
            }),
          }),
        })),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await UserService.getOrCreate('outseta-new', 'new@example.com');

      expect(result).toEqual(newUser);
    });

    it('should handle race condition on duplicate insert', async () => {
      let selectCallCount = 0;

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                  // First call: user not found
                  return Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116', message: 'No rows' },
                  });
                } else {
                  // Second call (retry): user found
                  return Promise.resolve({ data: mockUser, error: null });
                }
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'duplicate key value violates unique constraint' },
              }),
            }),
          }),
        })),
      };
      vi.mocked(getSupabaseClient).mockReturnValue(mockSupabase as never);

      const result = await UserService.getOrCreate('outseta-abc', 'test@example.com');

      expect(result).toEqual(mockUser);
      expect(selectCallCount).toBe(2);
    });
  });
});
