/**
 * Fact service for managing business facts
 *
 * Facts are stored per-business with a unique fact_type_id slot (for predefined types)
 * and a unique fact_id slot for legacy/custom. We enforce one fact per fact_type_id per business.
 */

import { getSupabaseClient } from "../supabase";
import type { DbFact, FactInsert, FactUpdate } from "../types/database";

// Feature flag to stub out Supabase for testing
const STUB_MODE = process.env.SUPABASE_STUB_MODE === "true";

type FactJoinRow = DbFact & {
  fact_types?: {
    id?: string | null;
    name?: string | null;
    category_id?: string | null;
    fact_categories?: { id?: string | null; name?: string | null } | null;
  } | null;
};

function createStubFact(data: FactInsert): DbFact {
  return {
    id: "stub-fact-" + (data.fact_id ?? data.fact_type_id ?? "unknown"),
    business_id: data.business_id,
    fact_id: data.fact_id,
    fact_value: data.fact_value,
    fact_type_id: data.fact_type_id ?? null,
    source_workflow: data.source_workflow ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================
// QUERIES
// ============================================

export async function getById(id: string): Promise<DbFact | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.from("facts").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch fact: ${error.message}`);
  }
  return data as DbFact;
}

export async function getByFactId(businessId: string, factId: string): Promise<DbFact | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("facts")
    .select("*")
    .eq("business_id", businessId)
    .eq("fact_id", factId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch fact: ${error.message}`);
  }
  return data as DbFact;
}

/**
 * Get all facts for a business, joined with type/category metadata.
 */
export async function getByBusinessId(businessId: string): Promise<DbFact[]> {
  if (STUB_MODE) return [];

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("facts")
    .select(
      `
      *,
      fact_types:facts_fact_type_id_fkey (
        id,
        name,
        category_id,
        fact_categories:fact_categories!fact_types_category_id_fkey ( id, name )
      )
    `
    )
    .eq("business_id", businessId)
    .order("fact_id", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch facts: ${error.message}`);
  }

  const rows = (data ?? []) as FactJoinRow[];
  return rows.map((r) => {
    const ft = r.fact_types ?? {};
    const fc = ft.fact_categories ?? {};
    return {
      ...r,
      fact_type_id: ft.id ?? null,
      fact_type_name: ft.name ?? null,
      category_id: fc.id ?? null,
      category_name: fc.name ?? null,
    } as DbFact;
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Upsert a fact. If fact_type_id is provided, we rely on the DB unique(business_id, fact_type_id)
 * to overwrite that slot. If fact_type_id is null, this acts like a custom fact keyed by fact_id.
 */
export async function upsert(data: FactInsert): Promise<DbFact> {
  if (STUB_MODE) return createStubFact(data);

  const supabase = getSupabaseClient();

  const payload: FactInsert = {
    business_id: data.business_id,
    fact_id: data.fact_id,
    fact_value: data.fact_value,
    source_workflow: data.source_workflow ?? null,
    fact_type_id: data.fact_type_id ?? null,
  };

  const { data: fact, error } = await supabase
    .from("facts")
    .upsert(payload, {
      onConflict: "business_id,fact_type_id",
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert fact: ${error.message}`);
  }

  return fact as DbFact;
}

export async function update(id: string, data: FactUpdate): Promise<DbFact> {
  const supabase = getSupabaseClient();

  const payload: FactUpdate = {
    fact_value: data.fact_value,
    source_workflow: data.source_workflow ?? null,
    fact_type_id: data.fact_type_id ?? null,
  };

  const { data: fact, error } = await supabase.from("facts").update(payload).eq("id", id).select().single();

  if (error) {
    throw new Error(`Failed to update fact: ${error.message}`);
  }

  return fact as DbFact;
}

export async function deleteByFactId(businessId: string, factId: string): Promise<boolean> {
  if (STUB_MODE) return true;

  const supabase = getSupabaseClient();

  const { error, count } = await supabase
    .from("facts")
    .delete({ count: "exact" })
    .eq("business_id", businessId)
    .eq("fact_id", factId);

  if (error) {
    throw new Error(`Failed to delete fact: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

export async function deleteById(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error, count } = await supabase.from("facts").delete({ count: "exact" }).eq("id", id);

  if (error) {
    throw new Error(`Failed to delete fact: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
