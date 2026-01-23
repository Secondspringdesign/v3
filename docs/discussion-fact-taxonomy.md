---
layout: default
title: "Discussion: Fact Taxonomy"
permalink: /discussion-fact-taxonomy/
nav_exclude: true

doc_type: discussion
doc_status: draft
doc_owner: "@jon"
last_updated: 2026-01-23
---

# Discussion: Fact Taxonomy

| Field | Value |
|:------|:------|
| **Owner** | @jon |
| **Status** | Draft - For Team Discussion |
| **Last Updated** | 2026-01-23 |
| **Participants** | Jon, Christian, Eric |

---

## Purpose

Define the categories and fact types for the v2 facts schema. This document captures Eric's architectural thinking, the wireframe UI design, and provides a starting point for team alignment.

---

## Two Inputs to Reconcile

We have two views of how facts should be organized:

| Source | Categories | Granularity |
|:-------|:-----------|:------------|
| **Eric's Model** | 9 categories (A-I) | Detailed, semantic groupings |
| **Wireframe UI** | 3 categories + Planner | Simplified for user display |

**Key question:** Are these in conflict, or is the wireframe a simplified UI grouping of Eric's detailed model?

---

## Wireframe: What Users See

From the Context Panel wireframe:

```
BUSINESS HUB
├── [Business Selector: "Second Spring"]
├── Planner (0 done · 4 open)
│   ├── Today: tasks...
│   ├── This Week: tasks...
│   ├── Next: tasks...
│   └── Completed: tasks...
├── Facts tab
│   ├── ESSENTIALS
│   ├── OFFER
│   └── GO-TO-MARKET
└── Files tab
    └── DOCUMENTS (Plan & Reality Check, etc.)
```

**Observations:**
1. **Planner** is separate from Facts - it's a task list with time-based groupings
2. **Facts** has 3 high-level categories: ESSENTIALS, OFFER, GO-TO-MARKET
3. **Files** shows documents (already have a `documents` table)
4. Tasks are tagged by workflow (Money, Product, Marketing, Business)

---

## Eric's Model: 9 Fact Categories

From Eric's architecture diagram, facts are organized into 9 categories (A-I):

### A. Venture Identity Facts
> "These anchor everything else"

- Business name
- Venture stage (1-9 flat)
- Venture type (service, product, hybrid, local, digital)
- Short description (1-2 sentences max)
- Primary goal (e.g., "replace $X income", "side income", "test viability")

**Purpose:** Answer "What are we actually building?"

---

### B. Founder Constraints
> "This is a big differentiator for us"

- Time constraints (hours per week/month)
- Budget constraints (range, not precision)
- Skills and unfair advantages
- Hard constraints (location-bound, health, caregiving, etc.)

**Purpose:** These are facts, not preferences. Blockers. The agent must respect them. Plans are invalid without them.

---

### C. Customer & Problem Facts
> "This should be one agreed version, not a brainstorm list"

- Target customer description (concise, canonical)
- Primary problem being solved
- Context of the problem (when/where it shows up)
- Why the problem matters (impact, urgency)

**Purpose:** Single source of truth for who we're serving and why.

---

### D. Offer Facts
> "Current or proposed offer - structured truth"

- Proposed offer (what is being sold)
- Delivery model (1:1, async, cohort, productized, etc.)
- Price range (even if provisional)
- What's included / excluded

**Purpose:** If it affects feasibility or income, it belongs here.

---

### E. Business Model Facts
> "Lightweight, but critical"

- Revenue model (how the money comes in)
- Cost structure assumptions (high-level)
- Primary acquisition channel (current hypothesis)

**Purpose:** Even if tentative, once acknowledged, these become facts until changed.

---

### F. Decision Facts
> "This is one of the most important sections"

- Explicit decisions made during a sprint
- "We are not pursuing Y idea"
- Go / no-go decisions
- Short rationale if relevant

**Purpose:** Prevents conversational drift and re-litigation.

---

### G. Active Plan Facts
> "Only what's current (not log)"

- Current 30-day plan
- Current experiment
- What's in progress vs. done

**Purpose:** Keeps the Context Panel forward-looking.

---

### H. Hypothesis Facts
> "SSD should be very explicit here"

- Active hypothesis
- What would validate or invalidate them
- Next test planned

**Purpose:** These are facts about uncertainty, which is a strength.

---

### I. Risk & Feasibility Signals
> "No scary internals - just user-safe signals"

- Primary risks identified (assessed, unassessed)
- Feasibility status (e.g., "plausible", "challenging", "high risk")
- What mitigates the risk

**Purpose:** Not scores. Not weights. Just meaning.

---

## Reconciling Eric's Model with Wireframe

**Possible mapping:** The wireframe's 3 categories could be UI groupings of Eric's 9:

| Wireframe Category | Eric's Categories (A-I) | Rationale |
|:-------------------|:------------------------|:----------|
| **ESSENTIALS** | A. Venture Identity + B. Founder Constraints + C. Customer & Problem | Core "what is this business" facts |
| **OFFER** | D. Offer Facts | What's being sold |
| **GO-TO-MARKET** | E. Business Model | How it makes money, reaches customers |
| *(Planner - separate)* | G. Active Plan Facts | Tasks, not key-value facts |
| *(Not shown)* | F. Decision Facts | May live in Planner or separate |
| *(Not shown)* | H. Hypothesis Facts | May need separate treatment |
| *(Not shown)* | I. Risk & Feasibility | Agent-facing, not user panel? |

**Open questions:**
1. Is this mapping correct, or should wireframe categories be renamed to match Eric's?
2. Where do F (Decisions), H (Hypotheses), I (Risk) live in the UI?
3. Are ESSENTIALS/OFFER/GO-TO-MARKET the right user-facing names?

---

## Planner: Not Facts, But Tasks

The **Planner** section in the wireframe is structurally different from facts:

| Aspect | Facts | Planner Tasks |
|:-------|:------|:--------------|
| **Structure** | Key-value pairs | Title + metadata |
| **Lifecycle** | Updated/replaced | Created → Completed |
| **Grouping** | By category | By time (Today, This Week, Next) |
| **Tags** | None | Workflow (Money, Product, Marketing, Business) |

**Suggested: Separate `tasks` table**

```sql
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    due_period      TEXT CHECK (due_period IN ('today', 'this_week', 'next')),
    workflow_tag    TEXT,                    -- 'money', 'product', 'marketing', 'business'
    completed       BOOLEAN DEFAULT FALSE,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

This aligns with Eric's category G (Active Plan Facts) but models it properly as tasks rather than forcing it into the facts key-value structure.

**Question:** Should tasks be agent-created, user-created, or both?

---

## Architectural Context

Eric's diagram defines three domains:

| Domain | Description | Example |
|:-------|:------------|:--------|
| **(A) SHOW** | What the user sees | Dashboard, Context Panel |
| **(B) THINK** | Agent-only reasoning | Scores, weights, confidence |
| **(C) STORE** | What the system persists | Database tables |

**Key intersections:**
- **A∩C (Dashboard):** User can edit and expects to persist
- **B∩C (Engine):** Agent writes structured objects, logs uncertainty
- **A∩B (Conversation):** Natural language, guidance, coaching
- **A∩B∩C (Context Panel):** Canonical facts shared across all three

---

## Open Questions for Discussion

### 1. Visibility

Should some facts be **agent-only** (B∩C) vs **user-visible** (A∩B∩C)?

| Option | Pros | Cons |
|:-------|:-----|:-----|
| All facts user-visible | Simpler, transparent | Agent may need private notes |
| Add `visibility` column | Flexible | More complexity |

---

### 2. Structured vs Simple Facts

Some of Eric's categories seem more **structured** than key-value pairs:

| Category | Structure | Recommendation |
|:---------|:----------|:---------------|
| G. Active Plan | Tasks with status, due dates | **Separate `tasks` table** (see Planner section above) |
| H. Hypothesis | Validation criteria, next test | Separate table or JSON in fact_value |
| F. Decision | Rationale, timestamp, decided_by | Separate table or JSON in fact_value |

**Observation:** The wireframe confirms Active Plan should be a **Planner** (tasks table), not facts. This validates Eric's intuition that some "facts" need richer structure.

---

### 3. Decision Facts - Extra Fields?

Decisions seem to need:
- `decided_at` timestamp
- `rationale` text
- Maybe `decided_by` (user vs agent suggestion)

**Question:** Add these as columns, or encode in `fact_value` as JSON?

---

### 4. Naming Convention

Should we use Eric's semantic names (A-I) or the wireframe's user-friendly names?

| Option | Example | Pros | Cons |
|:-------|:--------|:-----|:-----|
| Eric's names | "Venture Identity", "Founder Constraints" | Precise, self-documenting | More categories to display |
| Wireframe names | "ESSENTIALS", "OFFER" | Simpler UI, fewer sections | Less precise, grouping may confuse |
| Hybrid | Wireframe as parents, Eric's as children | Best of both | More complex hierarchy |

---

## Next Steps

1. **Reconcile Eric's model with wireframe** - Confirm the mapping (or adjust wireframe categories)
2. **Decide: tasks table for Planner?** - Separate from facts, or force into facts structure?
3. **Align on v1 scope** - Which categories and fact types to implement first?
4. **Define specific fact types** - What are the exact `fact_type_id` values within each category?
5. **Naming convention** - Eric's semantic names vs wireframe's simplified names?
6. **Seed data** - Create initial categories and types for migration

---

## Related Documents

- [Proposal: Facts Schema v2](/docs/proposal-facts-schema-v2.md) - Technical schema changes
- Eric's Architecture Diagram - Source for the A-I taxonomy
- Wireframe (Context Panel) - Source for ESSENTIALS/OFFER/GO-TO-MARKET grouping

