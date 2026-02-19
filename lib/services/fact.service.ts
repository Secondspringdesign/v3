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

type FactCategoriesJoin = {
  id?: string | null;
  name?: string | null;
} | null;

type FactTypesJoin = {
  id?: string | null;
  name?: string | null;
  category_id?: string | null;
  fact_categories?: FactCategoriesJoin;
} | null;

type FactQueryRow = {
  id: string;
  business_id: string;
  fact_id: string;
  fact_value: string;
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
  fact_type_id: string | null;
  fact_types?: FactTypesJoin;
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
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch fact by fact_id:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      businessId,
      factId,
    });
    throw new Error(`Failed to fetch fact: ${error.message}`);
  }
  return data as DbFact;
}

export async function getByFactTypeId(businessId: string, factTypeId: string): Promise<DbFact | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("facts")
    .select("*")
    .eq("business_id", businessId)
    .eq("fact_type_id", factTypeId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch fact by fact_type_id:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      businessId,
      factTypeId,
    });
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
      id,
      business_id,
      fact_id,
      fact_value,
      source_workflow,
      created_at,
      updated_at,
      fact_type_id,
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

  const rows = (data ?? []) as FactQueryRow[];
  return rows.map((r) => {
    const ft = r.fact_types ?? {};
    const fc = ft.fact_categories ?? {};
    const fact: DbFact = {
      id: r.id,
      business_id: r.business_id,
      fact_id: r.fact_id,
      fact_value: r.fact_value,
      source_workflow: r.source_workflow,
      created_at: r.created_at,
      updated_at: r.updated_at,
      fact_type_id: ft.id ?? null,
      fact_type_name: ft.name ?? null,
      category_id: fc?.id ?? null,
      category_name: fc?.name ?? null,
    };
    return fact;
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Upsert a fact. Uses select-then-update/insert pattern for both fact_type_id
 * and fact_id based facts.
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

  // When fact_type_id is provided, use select-then-update/insert pattern
  if (data.fact_type_id) {
    const existing = await getByFactTypeId(data.business_id, data.fact_type_id);

    if (existing) {
      // Update the existing fact
      const { data: fact, error } = await supabase
        .from("facts")
        .update({
          fact_value: payload.fact_value,
          source_workflow: payload.source_workflow,
          fact_id: payload.fact_id,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Failed to update fact (fact_type_id path):", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          payload,
          existingId: existing.id,
        });
        throw new Error(`Failed to update fact: ${error.message}`);
      }

      return fact as DbFact;
    } else {
      // FALLBACK: check by fact_id in case the row exists with fact_type_id = NULL (legacy data)
      const existingByFactId = await getByFactId(data.business_id, data.fact_id);
      
      if (existingByFactId) {
        // Update existing row AND backfill fact_type_id
        const { data: fact, error } = await supabase
          .from("facts")
          .update({
            fact_value: payload.fact_value,
            source_workflow: payload.source_workflow,
            fact_id: payload.fact_id,
            fact_type_id: payload.fact_type_id, // backfill the typed slot
          })
          .eq("id", existingByFactId.id)
          .select()
          .single();

        if (error) {
          console.error("Failed to update fact (fact_id fallback path):", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            payload,
            existingId: existingByFactId.id,
          });
          throw new Error(`Failed to update fact: ${error.message}`);
        }

        return fact as DbFact;
      } else {
        // Truly new fact — insert
        const { data: fact, error } = await supabase
          .from("facts")
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.error("Failed to insert fact (fact_type_id path):", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            payload,
          });
          throw new Error(`Failed to insert fact: ${error.message}`);
        }

        return fact as DbFact;
      }
    }
  }

  // When fact_type_id is null, use select-then-update/insert pattern
  // Check if a fact with the same business_id and fact_id already exists
  const existing = await getByFactId(data.business_id, data.fact_id);

  if (existing) {
    // Update the existing fact
    const { data: fact, error } = await supabase
      .from("facts")
      .update({
        fact_value: payload.fact_value,
        source_workflow: payload.source_workflow,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update fact (fact_id path):", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload,
        existingId: existing.id,
      });
      throw new Error(`Failed to update fact: ${error.message}`);
    }

    return fact as DbFact;
  } else {
    // Insert a new fact
    const { data: fact, error } = await supabase
      .from("facts")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Failed to insert fact (fact_id path):", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload,
      });
      throw new Error(`Failed to insert fact: ${error.message}`);
    }

    return fact as DbFact;
  }
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
