/**
 * Business service for managing business records
 *
 * Each user has one active business (auto-created on first API call).
 * Businesses can be archived but not deleted.
 */

import { getSupabaseClient } from '../supabase';
import type { DbBusiness, BusinessInsert, BusinessUpdate, BusinessStatus } from '../types/database';

// ============================================
// QUERIES
// ============================================

/**
 * Get a business by its internal ID
 *
 * @param id - The internal UUID
 * @returns The business record or null if not found
 */
export async function getById(id: string): Promise<DbBusiness | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch business: ${error.message}`);
  }

  return data as DbBusiness;
}

/**
 * Get all businesses for a user
 *
 * @param userId - The user's internal ID
 * @param status - Optional status filter ('active' | 'archived')
 * @returns Array of business records
 */
export async function getByUserId(
  userId: string,
  status?: BusinessStatus
): Promise<DbBusiness[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('businesses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch businesses: ${error.message}`);
  }

  return (data ?? []) as DbBusiness[];
}

/**
 * Get the active business for a user
 *
 * @param userId - The user's internal ID
 * @returns The active business or null if none exists
 */
export async function getActiveByUserId(userId: string): Promise<DbBusiness | null> {
  const businesses = await getByUserId(userId, 'active');
  return businesses[0] ?? null;
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new business
 *
 * @param data - Business data to insert
 * @returns The created business
 */
async function create(data: BusinessInsert): Promise<DbBusiness> {
  const supabase = getSupabaseClient();

  const { data: business, error } = await supabase
    .from('businesses')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create business: ${error.message}`);
  }

  return business as DbBusiness;
}

/**
 * Update an existing business
 *
 * @param id - The business's internal ID
 * @param data - Fields to update
 * @returns The updated business
 */
export async function update(id: string, data: BusinessUpdate): Promise<DbBusiness> {
  const supabase = getSupabaseClient();

  const { data: business, error } = await supabase
    .from('businesses')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update business: ${error.message}`);
  }

  return business as DbBusiness;
}

/**
 * Archive a business
 *
 * @param id - The business's internal ID
 * @returns The archived business
 */
export async function archive(id: string): Promise<DbBusiness> {
  return update(id, { status: 'archived' });
}

// ============================================
// AUTO-CREATION
// ============================================

/**
 * Get or create the active business for a user
 *
 * This is the primary entry point for business access. It:
 * 1. Attempts to find an existing active business for the user
 * 2. Creates a new business if none exists
 * 3. Handles race conditions when multiple requests try to create simultaneously
 *
 * @param userId - The user's internal ID
 * @returns The existing or newly created active business
 */
export async function getOrCreateActive(userId: string): Promise<DbBusiness> {
  // Try to find existing active business first
  const existing = await getActiveByUserId(userId);
  if (existing) {
    return existing;
  }

  // No active business, try to create one
  try {
    return await create({
      user_id: userId,
      name: 'My Business',
      status: 'active',
    });
  } catch (err) {
    // Handle race condition: another request may have created a business
    // Unlike users, there's no unique constraint, but we still check for duplicates
    const message = err instanceof Error ? err.message : String(err);

    // If there was an error, check if a business was created by another request
    const business = await getActiveByUserId(userId);
    if (business) {
      return business;
    }

    // Re-throw if we still couldn't find a business
    throw err;
  }
}
