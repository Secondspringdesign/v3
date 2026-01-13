/**
 * User service for managing user records
 *
 * Users are auto-created on first API call using their Outseta UID.
 * Handles race conditions when multiple requests arrive simultaneously.
 */

import { getSupabaseClient } from '../supabase';
import type { DbUser, UserInsert, UserUpdate } from '../types/database';

// Feature flag to stub out Supabase for testing
const STUB_MODE = process.env.SUPABASE_STUB_MODE === 'true';

function createStubUser(outsetaUid: string, email?: string | null): DbUser {
  return {
    id: 'stub-user-' + outsetaUid,
    outseta_uid: outsetaUid,
    email: email ?? 'stub@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================
// QUERIES
// ============================================

/**
 * Get a user by their Outseta UID
 *
 * @param outsetaUid - The Outseta user identifier
 * @returns The user record or null if not found
 */
export async function getByOutsetaUid(outsetaUid: string): Promise<DbUser | null> {
  if (STUB_MODE) {
    return createStubUser(outsetaUid);
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('outseta_uid', outsetaUid)
    .single();

  if (error) {
    // PGRST116 = no rows returned (not an error for our use case)
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data as DbUser;
}

/**
 * Get a user by their internal ID
 *
 * @param id - The internal UUID
 * @returns The user record or null if not found
 */
export async function getById(id: string): Promise<DbUser | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data as DbUser;
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new user
 *
 * @param data - User data to insert
 * @returns The created user
 * @throws Error if creation fails (including unique constraint violation)
 */
async function create(data: UserInsert): Promise<DbUser> {
  const supabase = getSupabaseClient();

  const { data: user, error } = await supabase
    .from('users')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return user as DbUser;
}

/**
 * Update an existing user
 *
 * @param id - The user's internal ID
 * @param data - Fields to update
 * @returns The updated user
 */
export async function update(id: string, data: UserUpdate): Promise<DbUser> {
  const supabase = getSupabaseClient();

  const { data: user, error } = await supabase
    .from('users')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return user as DbUser;
}

// ============================================
// AUTO-CREATION
// ============================================

/**
 * Get or create a user by their Outseta UID
 *
 * This is the primary entry point for user management. It:
 * 1. Attempts to find an existing user by outseta_uid
 * 2. Creates a new user if not found
 * 3. Handles race conditions when multiple requests try to create simultaneously
 *
 * @param outsetaUid - The Outseta user identifier
 * @param email - Optional email address
 * @returns The existing or newly created user
 */
export async function getOrCreate(
  outsetaUid: string,
  email?: string | null
): Promise<DbUser> {
  if (STUB_MODE) {
    return createStubUser(outsetaUid, email);
  }

  // Try to find existing user first
  const existing = await getByOutsetaUid(outsetaUid);
  if (existing) {
    // Optionally update email if provided and different
    if (email && email !== existing.email) {
      return update(existing.id, { email });
    }
    return existing;
  }

  // User doesn't exist, try to create
  try {
    return await create({
      outseta_uid: outsetaUid,
      email: email ?? null,
    });
  } catch (err) {
    // Handle race condition: another request may have created the user
    // Check if error is a unique constraint violation
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('duplicate') || message.includes('unique')) {
      // Retry the lookup
      const user = await getByOutsetaUid(outsetaUid);
      if (user) {
        return user;
      }
    }
    // Re-throw if it's a different error or user still not found
    throw err;
  }
}
