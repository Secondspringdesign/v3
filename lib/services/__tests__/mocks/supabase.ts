import { vi } from 'vitest';

/**
 * Creates a mock Supabase query builder chain
 */
export function createMockQueryBuilder(options: {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number;
} = {}) {
  const { data = null, error = null, count } = options;

  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };

  // For non-single queries
  builder.select.mockImplementation(() => {
    const selectBuilder = { ...builder };
    // If no .single() is called, return array
    selectBuilder.single = vi.fn().mockResolvedValue({ data, error });
    return selectBuilder;
  });

  // For queries without .single()
  Object.defineProperty(builder, 'then', {
    value: (resolve: (value: { data: unknown; error: unknown; count?: number }) => void) => {
      resolve({ data: Array.isArray(data) ? data : data ? [data] : [], error, count });
    },
  });

  return builder;
}

/**
 * Creates a mock Supabase client
 */
export function createMockSupabaseClient() {
  return {
    from: vi.fn(),
  };
}

/**
 * Setup mock for a specific table query
 */
export function mockTableQuery(
  mockClient: ReturnType<typeof createMockSupabaseClient>,
  tableName: string,
  queryBuilder: ReturnType<typeof createMockQueryBuilder>
) {
  mockClient.from.mockImplementation((table: string) => {
    if (table === tableName) {
      return queryBuilder;
    }
    return createMockQueryBuilder({ error: { message: 'Table not mocked' } });
  });
}
