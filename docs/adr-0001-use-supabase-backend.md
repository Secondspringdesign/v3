---
layout: default
title: "ADR-0001: Use Supabase for Backend Storage"
permalink: /adr-0001-use-supabase-backend/
nav_exclude: true

doc_type: adr
doc_status: accepted
doc_owner: "@engineering"
last_updated: 2026-01-06
related:
  - title: "Backend Architecture Proposal"
    url: /secondspring-v3/design-backend-architecture/
  - title: "PRD: Phase 1 Foundation"
    url: /secondspring-v3/spec-phase1-foundation/
  - title: "Plan: Phase 1 Implementation"
    url: /secondspring-v3/plan-phase1-implementation/
---

# ADR-0001: Use Supabase for Backend Storage
{: .no_toc }

| Field | Value |
|:------|:------|
| **Owner** | @engineering |
| **Status** | Accepted |
| **Date** | 2026-01-06 |
| **Supersedes** | None |
| **Superseded by** | None |

---

## Context

Second Spring is an AI-powered workspace helping users build businesses. Users interact with AI workflows (Business, Product, Marketing, Money) that extract and remember "facts" about their business.

Currently, these facts are captured via a `record_fact` client tool but **not persisted**. We need a backend to store user state, facts, documents, and workflow progress.

**Current architecture:**
- Framer (host + auth)
- Vercel Edge (Next.js API routes)
- Outseta (identity via JWT)
- OpenAI ChatKit (AI engine)
- Supabase (minimal - only PDF storage currently)

**Decision drivers:**
- Budget sensitivity (high)
- Data sensitivity (medium-high - business IP)
- Expected users: 1,000s in first 12 months
- GDPR compliance required
- No real-time sync requirements

---

## Decision

We will use **Supabase** (Option A from the Backend Architecture Proposal) as our persistent storage backend.

{: .important }
> Supabase will handle all persistent storage: users, businesses, facts, documents, and workflow progress via PostgreSQL with Row-Level Security.

---

## Rationale

We chose Supabase because:

1. **Already deployed** — Supabase instance exists for PDF storage; extending it has zero migration cost
2. **Row-Level Security** — Database-enforced access control provides defense-in-depth for business-sensitive data
3. **Predictable pricing** — Free tier likely sufficient through 2025; Pro tier is flat $25/mo vs. usage-based alternatives
4. **GDPR-friendly** — Built-in export tooling and data management dashboard
5. **Easy to migrate later** — If Vercel-native becomes compelling, data is portable

---

## Alternatives Considered

### Alternative: Vercel-Native (Vercel Postgres + Neon)

Single-platform architecture using Vercel Postgres for all persistence.

- **Pros**: Single platform/dashboard, lower latency (co-located), unified Node.js runtime
- **Cons**: No Row-Level Security (app-only access control), usage-based pricing can spike unexpectedly, newer/less battle-tested
- **Why rejected**: Usage-based pricing risk and lack of RLS outweigh the single-platform simplicity benefit at this scale

---

## Consequences

### Positive

- Predictable monthly costs ($0-25 depending on growth)
- Database-level security via RLS policies
- Existing tooling and familiarity
- Built-in backup and data export capabilities

### Negative

- Two platforms to manage (Vercel + Supabase)
- Slightly higher latency (~10-20ms extra network hop)
- Different runtime if Edge Functions ever needed (Deno vs Node.js)

### Neutral

- Team learns Supabase patterns (investment pays off for future projects)

---

## Implementation Notes

- Use service role key for API routes (server-side only, never expose client-side)
- RLS policies configured for defense-in-depth, even when using service key
- Auto-create user/business on first fact save for frictionless UX
- See [Plan: Phase 1 Implementation](/secondspring-v3/plan-phase1-implementation/) for detailed tasks

---

## References

- [Backend Architecture Proposal](/secondspring-v3/design-backend-architecture/) — Full evaluation of options
- [PRD: Phase 1 Foundation](/secondspring-v3/spec-phase1-foundation/) — Requirements specification
- [Plan: Phase 1 Implementation](/secondspring-v3/plan-phase1-implementation/) — Implementation tasks and dependencies

---

## Approvals

| Role | Name | Date |
|:-----|:-----|:-----|
| Engineering | @engineering | 2026-01-06 |
