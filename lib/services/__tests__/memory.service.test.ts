import { describe, it, expect } from 'vitest';
import { formatFactLabel, formatForAI, formatAsObject } from '../memory.service';
import type { DbFact } from '../../types/database';

const mockFact = (overrides: Partial<DbFact> = {}): DbFact => ({
  id: 'fact-123',
  business_id: 'business-456',
  fact_id: 'test_fact',
  fact_text: 'Test value',
  source_workflow: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('formatFactLabel', () => {
  it('should convert snake_case to Title Case', () => {
    expect(formatFactLabel('business_name')).toBe('Business Name');
    expect(formatFactLabel('target_audience')).toBe('Target Audience');
  });

  it('should handle single words', () => {
    expect(formatFactLabel('name')).toBe('Name');
    expect(formatFactLabel('industry')).toBe('Industry');
  });

  it('should strip version suffixes', () => {
    expect(formatFactLabel('business_name_v1')).toBe('Business Name');
    expect(formatFactLabel('target_audience_v2')).toBe('Target Audience');
    expect(formatFactLabel('industry_v10')).toBe('Industry');
  });

  it('should handle mixed case input', () => {
    expect(formatFactLabel('BUSINESS_NAME')).toBe('Business Name');
    expect(formatFactLabel('Target_Audience')).toBe('Target Audience');
  });
});

describe('formatForAI', () => {
  it('should return empty string for empty array', () => {
    expect(formatForAI([])).toBe('');
  });

  it('should format single fact correctly', () => {
    const facts = [mockFact({ fact_id: 'business_name', fact_text: 'Acme Corp' })];
    const result = formatForAI(facts);

    expect(result).toContain('## Business Memory');
    expect(result).toContain('**Business Name**: Acme Corp');
  });

  it('should format multiple facts correctly', () => {
    const facts = [
      mockFact({ fact_id: 'business_name', fact_text: 'Acme Corp' }),
      mockFact({ fact_id: 'target_audience', fact_text: 'Small businesses' }),
    ];
    const result = formatForAI(facts);

    expect(result).toContain('## Business Memory');
    expect(result).toContain('**Business Name**: Acme Corp');
    expect(result).toContain('**Target Audience**: Small businesses');
  });

  it('should strip version suffixes in labels', () => {
    const facts = [mockFact({ fact_id: 'business_name_v2', fact_text: 'Updated Corp' })];
    const result = formatForAI(facts);

    expect(result).toContain('**Business Name**: Updated Corp');
    expect(result).not.toContain('_v2');
  });
});

describe('formatAsObject', () => {
  it('should return empty object for empty array', () => {
    expect(formatAsObject([])).toEqual({});
  });

  it('should convert facts to key-value object', () => {
    const facts = [
      mockFact({ fact_id: 'business_name', fact_text: 'Acme Corp' }),
      mockFact({ fact_id: 'industry', fact_text: 'Technology' }),
    ];
    const result = formatAsObject(facts);

    expect(result).toEqual({
      business_name: 'Acme Corp',
      industry: 'Technology',
    });
  });

  it('should preserve fact_id as-is (no transformation)', () => {
    const facts = [mockFact({ fact_id: 'business_name_v1', fact_text: 'Corp' })];
    const result = formatAsObject(facts);

    expect(result).toEqual({
      business_name_v1: 'Corp',
    });
  });
});
