---
layout: default
title: "PRD: Phase 1 Foundation"
permalink: /spec-phase1-foundation/
nav_exclude: true

doc_type: spec
doc_status: approved
doc_owner: "@engineering"
last_updated: 2025-01-06
related:
  - title: "Backend Architecture Proposal"
    url: /secondspring-v3/design-backend-architecture/
---

# PRD: Second Spring Backend — Phase 1 (Foundation)
{: .no_toc }

| Field | Value |
|:------|:------|
| **Owner** | @engineering |
| **Status** | Approved |
| **Last Updated** | 2025-01-06 |
| **Related** | [Backend Architecture Proposal](/secondspring-v3/design-backend-architecture/) |

> **Purpose**: Initialize persistent storage for Second Spring using Supabase
> **Scope**: Schema creation, RLS policies, facts API, integration with `record_fact` tool
> **Target**: Claude Code implementation session

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Context

Second Spring is an AI-powered workspace helping users build businesses. Users interact with AI workflows (Business, Product, Marketing, Money) that extract and remember "facts" about their business—things like target customer, pricing model, value proposition, etc.

Currently, these facts are captured via a `record_fact` client tool but **not persisted**. This PRD covers the foundation work to store facts in Supabase and make them available across sessions.

### Current Architecture

```
Framer (host) → Vercel Edge (Next.js) → OpenAI ChatKit (AI)
                      ↓
              Outseta (identity via JWT)
```

### Target Architecture (Phase 1)

```
Framer (host) → Vercel Edge (Next.js) → OpenAI ChatKit (AI)
                      ↓
              Outseta (identity via JWT)
                      ↓
              Supabase (Postgres + RLS)
                      ↓
              [users, businesses, facts]
```

---

## Goals

1. **Persist facts** extracted by AI workflows so they survive across sessions
2. **Associate facts with users** via Outseta UID (from JWT)
3. **Inject facts as memory** when creating new ChatKit sessions
4. **Secure data** using Supabase Row-Level Security tied to user identity

### Non-Goals (Future Phases)

- Document storage and generation (Phase 3)
- Workflow progress tracking (Phase 4)
- GDPR export/deletion endpoints (Phase 4)
- Share links for documents (Phase 3)

---

## Data Model

### Entity Relationship

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    users    │──────▶│  businesses │──────▶│    facts    │
│             │  1:N  │             │  1:N  │             │
│ outseta_uid │       │ user_id     │       │ business_id │
│ email       │       │ name        │       │ fact_id     │
│ created_at  │       │ status      │       │ fact_text   │
└─────────────┘       └─────────────┘       │ source      │
                                            └─────────────┘
```

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Business as separate entity | Yes | Enables future multi-business support; clean "archive and restart" semantics |
| Auto-create business | Yes | On first fact save, create user + business if not exists. Frictionless UX. |
| Fact ID semantics | Upsert | Same `fact_id` overwrites previous value. Supports both predefined workflow IDs and dynamic IDs. |
| Memory injection | At session start | Modify `create-session` to fetch and inject facts. AI always has context. |

---

## Database Schema

### Tables

```sql
-- ============================================
-- USERS
-- Thin layer over Outseta identity
-- ============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outseta_uid     TEXT UNIQUE NOT NULL,
    email           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_outseta ON users(outseta_uid);

-- ============================================
-- BUSINESSES
-- Container for all user data; one active per user (for now)
-- ============================================
CREATE TABLE businesses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT DEFAULT 'My Business',
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_businesses_user ON businesses(user_id) WHERE status = 'active';

-- ============================================
-- FACTS
-- Atomic learnings about the user's business
-- ============================================
CREATE TABLE facts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    fact_id         TEXT NOT NULL,
    fact_text       TEXT NOT NULL,
    source_workflow TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, fact_id)
);

CREATE INDEX idx_facts_business ON facts(business_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- Auto-update timestamp on row modification
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER facts_updated_at
    BEFORE UPDATE ON facts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Row-Level Security Policies

The API will use a service role key (server-side only), so RLS provides defense-in-depth rather than primary access control.

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;

-- POLICY: Users can only access their own record
CREATE POLICY "Users access own record"
    ON users FOR ALL
    USING (outseta_uid = current_setting('app.current_user_id', true));

-- POLICY: Users can only access their own businesses
CREATE POLICY "Users access own businesses"
    ON businesses FOR ALL
    USING (
        user_id IN (
            SELECT id FROM users
            WHERE outseta_uid = current_setting('app.current_user_id', true)
        )
    );

-- POLICY: Users can only access facts for their businesses
CREATE POLICY "Users access own facts"
    ON facts FOR ALL
    USING (
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN users u ON b.user_id = u.id
            WHERE u.outseta_uid = current_setting('app.current_user_id', true)
        )
    );
```

{: .note }
> For Phase 1, we'll use the service role key with application-level auth checks. RLS is configured for future direct-client access if needed.

---

## API Specification

### Authentication

All endpoints require a valid Outseta JWT in the `Authorization: Bearer <token>` header. Token verification reuses the existing `verifyOutsetaToken()` function.

### Endpoints

#### `POST /api/facts`

Create or update a fact (upsert semantics).

**Request**:
```json
{
    "fact_id": "target_customer_v1",
    "fact_text": "Small business owners aged 35-50 who recently lost corporate jobs",
    "source_workflow": "business"
}
```

**Response** (200):
```json
{
    "success": true,
    "fact": {
        "id": "uuid",
        "fact_id": "target_customer_v1",
        "fact_text": "Small business owners aged 35-50...",
        "source_workflow": "business",
        "created_at": "2025-01-05T...",
        "updated_at": "2025-01-05T..."
    }
}
```

**Behavior**:
1. Verify Outseta token → extract `outseta_uid`
2. Get or create user record
3. Get or create active business for user
4. Upsert fact (insert or update if `fact_id` exists for this business)
5. Return the fact

**Error Responses**:
- `401`: Missing or invalid token
- `400`: Missing required fields (`fact_id`, `fact_text`)
- `500`: Database error

---

#### `GET /api/facts`

Retrieve all facts for the user's active business.

**Response** (200):
```json
{
    "facts": [
        {
            "id": "uuid",
            "fact_id": "target_customer_v1",
            "fact_text": "Small business owners...",
            "source_workflow": "business",
            "updated_at": "2025-01-05T..."
        }
    ]
}
```

---

#### `DELETE /api/facts/:fact_id`

Delete a specific fact.

**Response** (200):
```json
{
    "success": true,
    "deleted": "target_customer_v1"
}
```

---

#### `GET /api/memory`

Retrieve facts formatted for AI context injection.

**Response** (200):
```json
{
    "memory_context": "## What I Know About Your Business\n\n• Target customer: Small business owners aged 35-50...\n• Pricing model: $19/month subscription..."
}
```

---

## File Structure

New and modified files:

```
app/
├── api/
│   ├── create-session/
│   │   └── route.ts          # MODIFY: Add memory injection
│   ├── facts/
│   │   └── route.ts          # NEW: POST, GET handlers
│   ├── facts/
│   │   └── [factId]/
│   │       └── route.ts      # NEW: DELETE handler
│   └── memory/
│       └── route.ts          # NEW: GET formatted memory
lib/
├── supabase.ts               # NEW: Supabase client setup
├── auth.ts                   # NEW: Shared auth utilities
└── db/
    └── operations.ts         # NEW: Database operations
```

---

## Acceptance Criteria

### Schema & Database

- [ ] `users` table exists with `outseta_uid` unique index
- [ ] `businesses` table exists with foreign key to users
- [ ] `facts` table exists with unique constraint on `(business_id, fact_id)`
- [ ] All tables have `updated_at` auto-update triggers
- [ ] RLS policies are enabled (even if using service key)

### API Endpoints

- [ ] `POST /api/facts` creates new fact for authenticated user
- [ ] `POST /api/facts` updates existing fact if `fact_id` matches
- [ ] `POST /api/facts` auto-creates user and business if not exist
- [ ] `GET /api/facts` returns all facts for user's active business
- [ ] `GET /api/facts` returns empty array for new user
- [ ] `DELETE /api/facts/:factId` removes specific fact
- [ ] `GET /api/memory` returns formatted markdown context
- [ ] All endpoints return 401 for missing/invalid token

### Integration

- [ ] `record_fact` tool calls trigger `POST /api/facts`
- [ ] `create-session` fetches and injects memory context
- [ ] Facts persist across browser sessions
- [ ] Facts are user-isolated (user A cannot see user B's facts)

---

## Implementation Order

1. **Set up Supabase client** (`lib/supabase.ts`)
2. **Create auth utilities** (`lib/auth.ts`)
3. **Create database operations** (`lib/db/operations.ts`)
4. **Implement `GET /api/facts`**
5. **Implement `POST /api/facts`**
6. **Implement `DELETE /api/facts/:factId`**
7. **Implement `GET /api/memory`**
8. **Modify `create-session`** - add memory injection
9. **Wire `onWidgetAction`** - connect UI to API
10. **Create migration file**
11. **Update README**

---

## Future Phases

| Phase | Focus | Est. Effort | Dependencies |
|-------|-------|-------------|--------------|
| 1 (this PRD) | Facts + Memory | 2-3 days | None |
| 2 | Documents | 2-3 days | Phase 1 |
| 3 | Workflow Progress | 1-2 days | Phase 1 |
| 4 | GDPR & Polish | 1-2 days | Phases 1-3 |

---

## Open Questions

- [ ] ChatKit memory injection: What's the exact API for injecting context?
- [ ] Source workflow value: From URL param or explicit in `record_fact` call?
- [ ] Fact text size limit: Suggest 10,000 characters as reasonable limit.
- [ ] Rate limiting: Defer to Phase 4 unless trivial to add.

---

## Changelog

| Date | Author | Change |
|:-----|:-------|:-------|
| 2025-01-06 | @engineering | Initial PRD |
