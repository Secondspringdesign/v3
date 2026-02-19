---
layout: default
title: "Proposal: Facts Schema v2"
permalink: /proposal-facts-schema-v2/
nav_exclude: true

doc_type: proposal
doc_status: draft
doc_owner: "@jon"
last_updated: 2026-01-23
---

# Proposal: Facts Schema v2

| Field | Value |
|:------|:------|
| **Owner** | @jon |
| **Status** | Draft |
| **Last Updated** | 2026-01-23 |
| **Reviewers** | Christian, Eric |

---

## Summary

Restructure the `facts` table to use lookup tables for fact types and categories. This enforces consistency, enables UI-driven displays, and supports future agent tooling.

---

## Problem Statement

The current schema allows **free-form `fact_id` values**:

```sql
fact_id TEXT NOT NULL  -- No constraints on valid values
```

**Issues:**
1. Agents can write arbitrary strings (`business_name`, `Business Name`, `businessName`, `biz_name`)
2. No metadata about what fact types exist or what they mean
3. UI cannot query valid fact types from the database
4. No way to categorize or order facts for display
5. Junk entries accumulate over time

---

## Current Schema

```sql
CREATE TABLE facts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fact_id         TEXT NOT NULL,           -- Free-form, no constraints
    fact_text       TEXT NOT NULL,
    source_workflow TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, fact_id)
);
```

**Naming confusion:** `fact_id` sounds like a primary key but is actually a "type" or "key" identifier.

---

## Proposed Schema

### New Lookup Tables

```sql
-- Categories group related fact types (e.g., "Identity", "Constraints", "Goals")
CREATE TABLE fact_categories (
    id            TEXT PRIMARY KEY,         -- 'identity', 'constraints', 'goals'
    name          TEXT NOT NULL,            -- 'Identity', 'Constraints', 'Goals'
    description   TEXT,                     -- 'Core information about the venture'
    display_order INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Fact types define the specific facts that can be stored
CREATE TABLE fact_types (
    id            TEXT PRIMARY KEY,         -- 'business_name', 'time_per_week'
    category_id   TEXT NOT NULL REFERENCES fact_categories(id),
    name          TEXT NOT NULL,            -- 'Business Name', 'Time Per Week'
    description   TEXT,                     -- 'The official name of the business'
    display_order INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Facts Table

```sql
CREATE TABLE facts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fact_type_id    TEXT NOT NULL REFERENCES fact_types(id),  -- FK constraint
    fact_value      TEXT NOT NULL,                            -- Renamed for clarity
    source_workflow TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (business_id, fact_type_id)  -- One fact per type per business
);
```

### Column Renames

| Current | Proposed | Reason |
|:--------|:---------|:-------|
| `fact_id` | `fact_type_id` | Clarifies it's a type reference, not a PK |
| `fact_text` | `fact_value` | Pairs naturally with `fact_type_id` |

---

## Pros and Cons

### Pros

| Benefit | Description |
|:--------|:------------|
| **Enforced consistency** | FK constraint prevents typos and arbitrary strings |
| **Self-documenting** | Fact types have names and descriptions in the DB |
| **UI-queryable** | Frontend can fetch categories/types for display and grouping |
| **Ordered display** | `display_order` enables consistent UI presentation |
| **Agent tooling** | Agents can query valid types before writing |
| **Extensible** | Add new types via INSERT, no code changes |

### Cons

| Drawback | Mitigation |
|:---------|:-----------|
| **More tables** | Only 2 small lookup tables |
| **Migration required** | One-time migration, documented below |
| **Seed data needed** | Categories and types must be populated |
| **Slightly more complex writes** | Agent must use valid `fact_type_id` |

---

## Migration Path

### Step 1: Create lookup tables

```sql
CREATE TABLE fact_categories (...);
CREATE TABLE fact_types (...);
```

### Step 2: Seed initial data

Populate with agreed categories and types (see separate taxonomy discussion).

### Step 3: Add new column with FK

```sql
ALTER TABLE facts ADD COLUMN fact_type_id TEXT REFERENCES fact_types(id);
```

### Step 4: Migrate existing data

```sql
-- Map existing fact_id values to new fact_type_id
UPDATE facts SET fact_type_id = fact_id WHERE fact_id IN (SELECT id FROM fact_types);

-- Handle unmapped values (review manually or assign to 'other')
UPDATE facts SET fact_type_id = 'other' WHERE fact_type_id IS NULL;
```

### Step 5: Rename and constrain

```sql
ALTER TABLE facts DROP COLUMN fact_id;
ALTER TABLE facts ALTER COLUMN fact_type_id SET NOT NULL;
ALTER TABLE facts RENAME COLUMN fact_text TO fact_value;
```

### Step 6: Update RLS policies

No changes needed - policies reference `business_id`, not fact columns.

---

## Example Queries

### UI: Fetch all fact types grouped by category

```sql
SELECT
    c.id AS category_id,
    c.name AS category_name,
    t.id AS type_id,
    t.name AS type_name,
    t.description
FROM fact_categories c
JOIN fact_types t ON t.category_id = c.id
ORDER BY c.display_order, t.display_order;
```

### UI: Fetch user's facts with metadata

```sql
SELECT
    f.fact_value,
    t.name AS fact_name,
    t.description,
    c.name AS category_name
FROM facts f
JOIN fact_types t ON f.fact_type_id = t.id
JOIN fact_categories c ON t.category_id = c.id
WHERE f.business_id = $1
ORDER BY c.display_order, t.display_order;
```

### UI: Fetch all slots (filled or empty) for panel rendering

```sql
SELECT
    c.id AS category_id,
    c.name AS category_name,
    t.id AS type_id,
    t.name AS type_name,
    t.description,
    f.fact_value,                              -- NULL if unfilled
    f.updated_at
FROM fact_categories c
JOIN fact_types t ON t.category_id = c.id
LEFT JOIN facts f ON f.fact_type_id = t.id AND f.business_id = $1
ORDER BY c.display_order, t.display_order;
```

Returns all slots in display order - perfect for rendering the panel with placeholders for empty facts.

### Agent: Validate fact type before writing

```sql
SELECT EXISTS(SELECT 1 FROM fact_types WHERE id = $1) AS is_valid;
```

---

## Open Questions

1. **Seed data:** What categories and types should be included in v1? (See taxonomy discussion doc)
2. **Existing data:** How should we handle existing `fact_id` values that don't map to new types?
3. **Agent enforcement:** Should the API reject writes with invalid `fact_type_id`, or auto-create types?

---

## Related Documents

- [Discussion: Fact Taxonomy](/docs/discussion-fact-taxonomy.md) - Categories and types to implement
- [Phase 1 Foundation](/docs/deploy-phase1-foundation.md) - Original schema deployment

