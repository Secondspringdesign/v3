# Backend Architecture Proposal

> **Purpose:** Evaluate options for Second Spring's backend to store user state, facts, documents, and workflow progress.  
> **Status:** Proposal  
> **Date:** January 2025

---

## TL;DR

We need a backend to persist user data as users work through workspaces. Two viable options: **extend Supabase** (already in use) or **go Vercel-native**. Both work. Supabase is recommended for now due to lower cost, existing footprint, and built-in row-level security.

---

## Current Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Framer      │────▶│  Vercel Edge    │────▶│  OpenAI/ChatKit │
│  (Host + Auth)  │     │   (Next.js)     │     │   (AI Engine)   │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │                                              
         ▼                                              
┌─────────────────┐     ┌─────────────────┐            
│    Outseta      │     │    Supabase     │  ◀── Currently only
│  (Identity)     │     │  (PDF storage)  │      stores shared PDFs
└─────────────────┘     └─────────────────┘            
```

**What's missing:** Persistent storage for user-specific data.

---

## What Needs to Be Stored

| Entity | Description | Access Pattern |
|--------|-------------|----------------|
| **Facts** | Atomic learnings about user's business (from `record_fact` tool) | Write during sessions; read at session start |
| **Documents** | Business plans, SWOTs, reality checks (structured JSON) | Write on generation; read on demand |
| **Progress** | Workflow completion state | Read/write per session |
| **User Profile** | Preferences, linked Outseta UID | Read at session start |

**Not storing:** Conversation history (facts capture what matters; ChatKit handles session continuity).

---

## Decision Inputs

| Factor | Value | Impact |
|--------|-------|--------|
| Expected users (12 mo) | 1,000s | Either option handles this easily |
| Budget sensitivity | High | Favors predictable pricing |
| Team expertise | Flexible | Not a deciding factor |
| Data sensitivity | Medium-High (business IP) | Need encryption at rest, access controls |
| Multi-device sync | Not critical | No real-time requirements |
| GDPR compliance | Required | Need export + deletion endpoints |
| Existing infrastructure | Supabase (minimal), Vercel | Extending Supabase has zero migration cost |

---

## Option A: Supabase-Centric

Extend the existing Supabase instance to handle all persistence.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│   Framer    │────▶│   Vercel    │────▶│      Supabase       │
│   (Host)    │     │  (Next.js)  │     │  ┌───────────────┐  │
└─────────────┘     └─────────────┘     │  │   Postgres    │  │
       │                   │            │  │  (all tables) │  │
       ▼                   │            │  └───────────────┘  │
   Outseta                 │            │  ┌───────────────┐  │
   (Auth)                  │            │  │    Storage    │  │
                           │            │  │ (if needed)   │  │
                           │            │  └───────────────┘  │
                           │            └─────────────────────┘
                           │                      ▲
                           └──────────────────────┘
                              API calls (REST)
```

### Pros
- **Already in use** — zero migration, familiar tooling
- **Row-Level Security** — database enforces access control (defense in depth)
- **Predictable pricing** — free tier likely sufficient for 6-12 months; Pro is $25/mo flat
- **Built-in tooling** — dashboard, backups, easy data export for GDPR

### Cons
- **Two platforms** — Vercel for compute, Supabase for data
- **Extra network hop** — slightly higher latency (~10-20ms)
- **Different runtimes** — Supabase Edge Functions use Deno (if ever needed)

### Cost Estimate
| Tier | Included | Monthly Cost |
|------|----------|--------------|
| Free | 500MB DB, 1GB storage, 2GB bandwidth | $0 |
| Pro | 8GB DB, 100GB storage, 250GB bandwidth | $25 |

At 1,000s of users with moderate activity: **Free tier likely sufficient through 2025.**

---

## Option B: Vercel-Native

Use Vercel Postgres (powered by Neon) for a single-platform architecture.

```
┌─────────────┐     ┌───────────────────────────────────────┐
│   Framer    │────▶│               Vercel                  │
│   (Host)    │     │  ┌─────────────┐    ┌─────────────┐  │
└─────────────┘     │  │   Next.js   │───▶│  Postgres   │  │
       │            │  │  (App/API)  │    │   (Neon)    │  │
       ▼            │  └─────────────┘    └─────────────┘  │
   Outseta         │         │                             │
   (Auth)          │         ▼                             │
                    │  ┌─────────────┐                     │
                    │  │    Blob     │  (optional)         │
                    │  └─────────────┘                     │
                    └───────────────────────────────────────┘
```

### Pros
- **Single platform** — one dashboard, one deployment, one bill
- **Lower latency** — database co-located with compute
- **Unified runtime** — Node.js everywhere
- **Simpler CI/CD** — everything deploys together

### Cons
- **No Row-Level Security** — all access control in application code
- **Usage-based pricing** — can spike unexpectedly
- **Newer product** — Vercel Postgres launched 2023; less battle-tested

### Cost Estimate
| Resource | Unit Cost | Est. Monthly (1K users) |
|----------|-----------|-------------------------|
| Storage | $0.10/GB | ~$0.50 |
| Reads | $0.10/million | ~$2-5 |
| Writes | $1.00/million | ~$3-8 |
| **Total** | | **$5-15** |

⚠️ Usage-based pricing means costs scale with activity. Heavy usage month could spike to $30-50.

---

## Side-by-Side Comparison

| Criterion | Supabase | Vercel-Native |
|-----------|:--------:|:-------------:|
| Setup effort | Lower (exists) | Medium |
| Platform complexity | Two platforms | One platform |
| Row-Level Security | ✅ Built-in | ❌ App-only |
| Pricing model | Predictable | Usage-based |
| Latency | ~20ms higher | Optimal |
| GDPR tooling | ✅ Built-in | Manual |
| Risk profile | Lower | Slightly higher |

---

## Recommendation

**Start with Supabase (Option A).**

### Rationale
1. **Already deployed** — path of least resistance
2. **RLS provides security depth** — important for business-sensitive data
3. **Predictable costs** — critical during early discovery phase
4. **GDPR-friendly** — built-in export tooling
5. **Easy to migrate later** — if Vercel-native becomes compelling, data is portable

### When to Reconsider
- Supabase latency becomes noticeable (unlikely at this scale)
- Team strongly prefers single-platform operations
- Vercel Postgres matures + offers predictable pricing tier

---

## Proposed Data Model

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │──────▶│  Business   │──┬───▶│    Fact     │
│             │       │             │  │    │             │
│ outseta_uid │       │ name        │  │    │ fact_text   │
│ preferences │       │ status      │  │    │ source      │
└─────────────┘       └─────────────┘  │    └─────────────┘
                                       │
                      ┌─────────────┐  │    ┌─────────────┐
                      │  Progress   │◀─┼───▶│  Document   │
                      │             │  │    │             │
                      │ workflow    │  │    │ content     │
                      │ status      │  │    │ version     │
                      └─────────────┘  │    └──────┬──────┘
                                       │           │
                                       │    ┌──────▼──────┐
                                       │    │ ShareLink   │
                                       │    └─────────────┘
```

**Why Business as a separate entity?** Users work on one business now, but this enables "archive and start fresh" without data migration later.

---

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| **1. Foundation** | Schema + RLS + `/api/facts` endpoint | 1-2 days |
| **2. Memory** | Load facts into AI context at session start | 1 day |
| **3. Documents** | CRUD + PDF generation + share links | 2-3 days |
| **4. Polish** | Progress tracking + GDPR endpoints + audit log | 1-2 days |

**Total estimated effort: 5-8 days**

---

## Open Questions

1. **Fact IDs** — Are these defined in Agent Builder workflows or generated dynamically?
2. **Memory injection** — Inject at session creation, or have AI call `retrieve_memory` tool?
3. **Share link expiration** — Default duration? (Suggest: 30 days)
4. **PDF branding** — Specific templates needed, or minimal output acceptable for now?

---

## Next Steps

1. Review and align on Option A (Supabase)
2. Answer open questions above
3. Create schema + RLS policies in Supabase
4. Implement Phase 1 (facts endpoint + wire to `record_fact`)
5. Validate end-to-end before continuing to Phase 2

---

*Questions? Comments? Open an issue or reach out.*
