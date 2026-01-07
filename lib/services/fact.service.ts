/**
 * Fact service for managing business facts
 *
 * Facts are stored per-business with a unique fact_id that supports
 * upsert semantics (update existing fact or create new).
 */

import { getSupabaseClient } from '../supabase';
import type { DbFact, FactInsert, FactUpdate } from '../types/database';

// ============================================
// QUERIES
// ============================================

/**
 * Get a fact by its internal ID
 *
 * @param id - The internal UUID
 * @returns The fact record or null if not found
 */
export async function getById(id: string): Promise<DbFact | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('facts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch fact: ${error.message}`);
  }

  return data as DbFact;
}

/**
 * Get a fact by business_id and fact_id
 *
 * @param businessId - The business's internal ID
 * @param factId - The fact identifier (e.g., 'business_name')
 * @returns The fact record or null if not found
 */
export async function getByFactId(
  businessId: string,
  factId: string
): Promise<DbFact | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('facts')
    .select('*')
    .eq('business_id', businessId)
    .eq('fact_id', factId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch fact: ${error.message}`);
  }

  return data as DbFact;
}

/**
 * Get all facts for a business
 *
 * @param businessId - The business's internal ID
 * @returns Array of fact records, ordered by fact_id
 */
export async function getByBusinessId(businessId: string): Promise<DbFact[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('facts')
    .select('*')
    .eq('business_id', businessId)
    .order('fact_id', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch facts: ${error.message}`);
  }

  return (data ?? []) as DbFact[];
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Upsert a fact (insert or update on conflict)
 *
 * Uses the unique constraint on (business_id, fact_id) to either:
 * - Insert a new fact if fact_id doesn't exist for this business
 * - Update the existing fact if fact_id already exists
 *
 * @param data - Fact data to upsert
 * @returns The created or updated fact
 */
export async function upsert(data: FactInsert): Promise<DbFact> {
  const supabase = getSupabaseClient();

  const { data: fact, error } = await supabase
    .from('facts')
    .upsert(data, {
      onConflict: 'business_id,fact_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert fact: ${error.message}`);
  }

  return fact as DbFact;
}

/**
 * Update an existing fact by internal ID
 *
 * @param id - The fact's internal ID
 * @param data - Fields to update
 * @returns The updated fact
 */
export async function update(id: string, data: FactUpdate): Promise<DbFact> {
  const supabase = getSupabaseClient();

  const { data: fact, error } = await supabase
    .from('facts')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update fact: ${error.message}`);
  }

  return fact as DbFact;
}

/**
 * Delete a fact by business_id and fact_id
 *
 * @param businessId - The business's internal ID
 * @param factId - The fact identifier to delete
 * @returns true if deleted, false if fact didn't exist
 */
export async function deleteByFactId(
  businessId: string,
  factId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error, count } = await supabase
    .from('facts')
    .delete({ count: 'exact' })
    .eq('business_id', businessId)
    .eq('fact_id', factId);

  if (error) {
    throw new Error(`Failed to delete fact: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

/**
 * Delete a fact by internal ID
 *
 * @param id - The fact's internal ID
 * @returns true if deleted, false if fact didn't exist
 */
export async function deleteById(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error, count } = await supabase
    .from('facts')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete fact: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
