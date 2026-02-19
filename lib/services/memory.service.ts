/**
 * Memory service for formatting facts for AI context
 *
 * Transforms stored facts into a markdown format suitable for
 * injection into AI conversation context.
 */

import type { DbFact } from "../types/database";

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Convert snake_case to Title Case
 *
 * @example
 * formatLabel('business_name') // 'Business Name'
 * formatLabel('target_audience') // 'Target Audience'
 */
function snakeCaseToTitleCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Strip version suffix from fact_id
 *
 * Fact IDs may have version suffixes like '_v1', '_v2' for tracking changes.
 * These should be stripped for display.
 *
 * @example
 * stripVersionSuffix('business_name_v1') // 'business_name'
 * stripVersionSuffix('target_audience_v2') // 'target_audience'
 * stripVersionSuffix('business_name') // 'business_name'
 */
function stripVersionSuffix(factId: string): string {
  return factId.replace(/_v\d+$/, "");
}

/**
 * Format a fact_id into a human-readable label
 *
 * Strips version suffixes and converts to Title Case.
 *
 * @example
 * formatFactLabel('business_name_v1') // 'Business Name'
 * formatFactLabel('target_audience') // 'Target Audience'
 */
export function formatFactLabel(factId: string): string {
  const stripped = stripVersionSuffix(factId);
  return snakeCaseToTitleCase(stripped);
}

// ============================================
// MEMORY FORMATTING
// ============================================

/**
 * Format facts as markdown for AI context injection
 *
 * Creates a structured markdown document that can be included
 * in AI conversation context to provide business memory.
 *
 * @param facts - Array of facts to format
 * @returns Markdown string, empty string if no facts
 */
export function formatForAI(facts: DbFact[]): string {
  if (facts.length === 0) {
    return "";
  }

  const lines: string[] = ["## Business Memory", ""];

  for (const fact of facts) {
    const label = formatFactLabel(fact.fact_id);
    lines.push(`**${label}**: ${fact.fact_value}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Format facts as a simple key-value object
 *
 * Useful for API responses or client-side processing.
 *
 * @param facts - Array of facts to format
 * @returns Object mapping fact_id to fact_value
 */
export function formatAsObject(facts: DbFact[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const fact of facts) {
    result[fact.fact_id] = fact.fact_value;
  }
  return result;
}
