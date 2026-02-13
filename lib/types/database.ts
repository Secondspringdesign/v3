export interface DbFact {
  id: string;
  business_id: string;
  fact_id: string;
  fact_value: string;
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
  fact_type_id: string | null;
  fact_type_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
}

export interface FactInsert {
  business_id: string;
  fact_id: string;
  fact_value: string;
  source_workflow?: string | null;
  fact_type_id?: string | null;
}

export interface FactUpdate {
  fact_value?: string;
  source_workflow?: string | null;
  fact_type_id?: string | null;
}
