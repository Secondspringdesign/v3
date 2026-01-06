# PRD: Second Spring Backend — Phase 1 (Foundation)

> **Purpose**: Initialize persistent storage for Second Spring using Supabase  
> **Scope**: Schema creation, RLS policies, facts API, integration with `record_fact` tool  
> **Target**: Claude Code implementation session  

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

The API will use a service role key (server-side only), so RLS provides defense-in-depth rather than primary access control. Policies are written assuming a custom JWT claim or session variable for the Outseta UID.

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICY: Users can only access their own record
-- ============================================
CREATE POLICY "Users access own record"
    ON users FOR ALL
    USING (outseta_uid = current_setting('app.current_user_id', true));

-- ============================================
-- POLICY: Users can only access their own businesses
-- ============================================
CREATE POLICY "Users access own businesses"
    ON businesses FOR ALL
    USING (
        user_id IN (
            SELECT id FROM users 
            WHERE outseta_uid = current_setting('app.current_user_id', true)
        )
    );

-- ============================================
-- POLICY: Users can only access facts for their businesses
-- ============================================
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

**Note**: For Phase 1, we'll use the service role key with application-level auth checks. RLS is configured for future direct-client access if needed.

---

## API Specification

### Authentication

All endpoints require a valid Outseta JWT in the `Authorization: Bearer <token>` header. Token verification reuses the existing `verifyOutsetaToken()` function from `create-session/route.ts`.

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
        },
        {
            "id": "uuid",
            "fact_id": "pricing_model_v1",
            "fact_text": "$19/month subscription...",
            "source_workflow": "money",
            "updated_at": "2025-01-04T..."
        }
    ]
}
```

**Behavior**:
1. Verify Outseta token → extract `outseta_uid`
2. Find user's active business
3. Return all facts ordered by `updated_at DESC`
4. Return empty array if no user/business/facts exist

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

**Response** (404):
```json
{
    "error": "Fact not found"
}
```

---

#### `GET /api/memory`

Retrieve facts formatted for AI context injection.

**Response** (200):
```json
{
    "memory_context": "## What I Know About Your Business\n\n• Target customer: Small business owners aged 35-50...\n• Pricing model: $19/month subscription...\n• Value proposition: AI-powered business planning..."
}
```

**Behavior**:
1. Fetch all facts (same as `GET /api/facts`)
2. Format as markdown suitable for AI context
3. Return empty string if no facts exist

This endpoint is called by `create-session` to inject memory.

---

### Modify Existing Endpoint

#### `POST /api/create-session` (modification)

**Current behavior**: Creates ChatKit session with user ID.

**New behavior**: 
1. Before creating session, call internal memory retrieval
2. If facts exist, include them in the session context
3. Proceed with session creation

**Implementation note**: The ChatKit API may support injecting context via the session creation call. If not, the memory will need to be injected via a system message or tool. Research the ChatKit/OpenAI Sessions API for the exact mechanism.

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
    └── operations.ts         # NEW: Database operations (getOrCreateUser, etc.)
```

---

## Integration: Wire `record_fact` Tool

The `record_fact` client tool already exists in `ChatKitPanel.tsx`. Currently it does nothing persistent:

```typescript
// Current implementation (lines 456-467)
if (invocation.name === "record_fact") {
    const id = String(invocation.params.fact_id ?? "");
    const text = String(invocation.params.fact_text ?? "");
    if (!id || processedFacts.current.has(id)) return { success: true };
    processedFacts.current.add(id);
    void onWidgetAction({
        type: "save",
        factId: id,
        factText: text.replace(/\s+/g, " ").trim(),
    });
    return { success: true };
}
```

**Required change**: The `onWidgetAction` callback (passed from parent) should call `POST /api/facts`. The parent component that renders `ChatKitPanel` needs to implement this.

Locate where `ChatKitPanel` is rendered and ensure `onWidgetAction` makes the API call:

```typescript
const handleWidgetAction = async (action: FactAction) => {
    if (action.type === "save") {
        const token = await getOutsetaToken(); // Get current token
        await fetch("/api/facts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                fact_id: action.factId,
                fact_text: action.factText,
                source_workflow: currentAgent, // From URL param
            }),
        });
    }
};
```

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- Existing v3 codebase cloned

### Supabase Project Setup

**Important**: Each Supabase project is isolated. You can have multiple projects without collision.

```bash
# 1. Login to Supabase (one-time)
supabase login

# 2. Create a new project via dashboard (https://supabase.com/dashboard)
#    - Name: secondspring-dev (or similar)
#    - Region: Choose closest
#    - Generate a strong database password (save it!)

# 3. In your v3 project directory, initialize Supabase
cd /path/to/v3
supabase init

# 4. Link to your specific project (avoids collision with other projects)
supabase link --project-ref <your-project-ref>
#    Find project-ref in Supabase dashboard URL: 
#    https://supabase.com/dashboard/project/<project-ref>

# 5. Create migration file
supabase migration new foundation_schema

# 6. Paste the schema SQL (from this PRD) into:
#    supabase/migrations/<timestamp>_foundation_schema.sql

# 7. Apply migration to remote database
supabase db push
```

### Environment Variables

Create/update `.env.local`:

```bash
# Existing variables (keep these)
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_CHATKIT_WORKFLOW_BUSINESS=wf_...
# ... other workflow IDs

# New Supabase variables
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # service_role key (server-side only, NEVER expose to client)
SUPABASE_ANON_KEY=eyJ...     # anon key (for future client-side if needed)
```

**Where to find keys**:
1. Go to Supabase Dashboard → Your Project → Settings → API
2. Copy `URL`, `anon` key, and `service_role` key

### Local Development with Supabase

For local testing without affecting production:

```bash
# Start local Supabase (Docker required)
supabase start

# This gives you local URLs and keys:
# API URL: http://localhost:54321
# Service Key: eyJ... (local)

# Use these in .env.local for local dev:
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=<local-service-key>
```

**Switching between local and remote**:
- Local dev: Use `http://localhost:54321` URL and local keys
- Deployed: Use `https://<ref>.supabase.co` URL and remote keys
- Keep separate `.env.local` (local) and Vercel environment variables (production)

### Verify Setup

```bash
# Run the dev server
npm run dev

# Test the facts endpoint (should return 401 without token)
curl http://localhost:3000/api/facts

# With a valid token (get from browser dev tools after logging in)
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/facts
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
- [ ] All endpoints follow existing CORS patterns

### Integration

- [ ] `record_fact` tool calls trigger `POST /api/facts`
- [ ] `create-session` fetches and injects memory context
- [ ] Facts persist across browser sessions
- [ ] Facts are user-isolated (user A cannot see user B's facts)

### Local Development

- [ ] `supabase/migrations/` contains schema migration
- [ ] `.env.local.example` documents required variables
- [ ] Local Supabase can be started with `supabase start`
- [ ] README updated with setup instructions

---

## Testing Scenarios

### Manual Testing Script

```bash
# 1. Start local dev
npm run dev

# 2. Open browser, login via Outseta, open Network tab

# 3. Find an API request with Authorization header, copy the token

# 4. Create a fact
curl -X POST http://localhost:3000/api/facts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"fact_id": "test_fact", "fact_text": "This is a test", "source_workflow": "manual"}'

# 5. Verify it was created
curl http://localhost:3000/api/facts \
  -H "Authorization: Bearer <token>"

# 6. Update the fact (same fact_id, different text)
curl -X POST http://localhost:3000/api/facts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"fact_id": "test_fact", "fact_text": "Updated text", "source_workflow": "manual"}'

# 7. Verify it was updated (not duplicated)
curl http://localhost:3000/api/facts \
  -H "Authorization: Bearer <token>"

# 8. Get memory format
curl http://localhost:3000/api/memory \
  -H "Authorization: Bearer <token>"

# 9. Delete the fact
curl -X DELETE http://localhost:3000/api/facts/test_fact \
  -H "Authorization: Bearer <token>"

# 10. Verify deletion
curl http://localhost:3000/api/facts \
  -H "Authorization: Bearer <token>"
```

### Edge Cases to Verify

1. **New user flow**: First `POST /api/facts` should create user + business + fact
2. **Concurrent requests**: Two rapid `POST` calls with same `fact_id` should not error
3. **Empty fact_text**: Should return 400, not create empty fact
4. **Very long fact_text**: Should handle gracefully (consider TEXT column limit)
5. **Special characters**: fact_id with spaces, unicode, etc.
6. **Expired token**: Should return 401, not 500

---

## Open Questions (Resolve During Implementation)

1. **ChatKit memory injection**: What's the exact API for injecting context into a ChatKit session? Check OpenAI documentation for session creation payload.

2. **Source workflow value**: Should this come from the `agent` URL parameter, or should the AI workflow pass it explicitly in the `record_fact` call?

3. **Fact text size limit**: Should we enforce a maximum length? Suggest 10,000 characters as reasonable limit.

4. **Rate limiting**: Should `POST /api/facts` be rate-limited to prevent abuse? Defer to Phase 4 unless trivial to add.

---

## Implementation Order

Suggested sequence for Claude Code session:

1. **Set up Supabase client** (`lib/supabase.ts`)
2. **Create auth utilities** (`lib/auth.ts`) - extract/verify token, get user ID
3. **Create database operations** (`lib/db/operations.ts`) - getOrCreateUser, getOrCreateBusiness, upsertFact, etc.
4. **Implement `GET /api/facts`** - simplest endpoint, verifies setup works
5. **Implement `POST /api/facts`** - includes auto-create logic
6. **Implement `DELETE /api/facts/:factId`**
7. **Implement `GET /api/memory`** - formatting logic
8. **Modify `create-session`** - add memory injection
9. **Wire `onWidgetAction`** - connect UI to API
10. **Create migration file** - consolidate schema
11. **Update README** - document setup

---

## Future Phases (Separate PRDs)

This PRD covers Phase 1 only. The following phases will require their own PRDs:

### Phase 2: Documents (Est. 2-3 days)

**Purpose**: Store and share generated business documents.

**Scope**:
- `documents` table (business_id, doc_type, title, content as JSONB, version)
- `document_shares` table (share_token, expires_at)
- `POST /api/documents` — create document
- `GET /api/documents` — list documents for business
- `GET /api/documents/:id` — get document content
- `PUT /api/documents/:id` — update document
- `DELETE /api/documents/:id` — delete document
- `POST /api/documents/:id/share` — create share link
- `GET /api/documents/:id/export` — generate PDF on-demand
- `GET /api/share/:token` — public endpoint for shared documents
- PDF generation library integration (e.g., `@react-pdf/renderer` or `pdf-lib`)
- Migrate existing Supabase PDF storage bucket

**Key Decisions Needed**:
- PDF template/branding requirements
- Share link default expiration (7 days? 30 days? never?)
- Document versioning strategy (keep history or overwrite?)

---

### Phase 3: Workflow Progress (Est. 1-2 days)

**Purpose**: Track user progress through AI workflows.

**Scope**:
- `workflow_progress` table (business_id, workflow, status, progress_data as JSONB)
- `GET /api/progress` — get all workflow progress for business
- `PUT /api/progress/:workflow` — update specific workflow progress
- Integration with ChatKit to update progress based on conversation milestones
- UI indicators for workflow completion (may require Framer changes)

**Key Decisions Needed**:
- What constitutes "complete" for each workflow?
- Should progress be inferred from facts, or explicitly tracked?
- Progress data structure per workflow type

---

### Phase 4: GDPR & Polish (Est. 1-2 days)

**Purpose**: Compliance, security hardening, and operational readiness.

**Scope**:
- `GET /api/user/export` — export all user data as JSON/ZIP
- `DELETE /api/user` — delete account and cascade all data
- Audit logging table (who accessed what, when)
- Rate limiting on write endpoints
- Error monitoring integration (Sentry or similar)
- API documentation (OpenAPI spec or similar)
- Data retention policy implementation (auto-delete inactive accounts?)

**Key Decisions Needed**:
- Data retention period for inactive accounts
- Audit log retention period
- Rate limit thresholds
- Whether to support "soft delete" vs immediate hard delete

---

### Phase Summary

| Phase | Focus | Est. Effort | Dependencies |
|-------|-------|-------------|--------------|
| 1 (this PRD) | Facts + Memory | 2-3 days | None |
| 2 | Documents | 2-3 days | Phase 1 |
| 3 | Workflow Progress | 1-2 days | Phase 1 |
| 4 | GDPR & Polish | 1-2 days | Phases 1-3 |

**Total estimated effort**: 6-10 days

Phases 2 and 3 can be developed in parallel after Phase 1 is complete. Phase 4 should come last as it builds on the complete data model.

---

## Future Consideration: Vector Search

At some point, the question will arise: should we use vector embeddings and semantic search instead of loading all facts into context?

### When to Consider Vector Search

- Users accumulate 500+ facts
- Session start times exceed 2 seconds
- Token budget becomes constrained
- AI responses ignore relevant context due to context window limits

### What It Would Require

1. Enable pgvector extension in Supabase
2. Add `embedding vector(1536)` column to facts table
3. Generate embeddings via OpenAI API on fact creation
4. Create `POST /api/facts/search` endpoint for semantic retrieval
5. Add `retrieve_memory` server tool to Agent Builder workflows
6. Tune similarity thresholds empirically

### Why We're NOT Doing This Now

**Full load is actually better for Second Spring's use case, not just simpler.**

Business planning benefits from complete context. The AI making connections between seemingly unrelated facts ("your target customer is price-sensitive, so your premium pricing might be a problem") is a feature, not a bug.

**Key concerns with vector search for this use case:**

1. **Retrieval can miss important context**: A query about pricing might not retrieve target customer facts, even though they're critical to pricing decisions. The AI doesn't know what it doesn't know—it can't ask for facts it didn't retrieve.

2. **Business context is interconnected**: Target customer affects pricing affects marketing affects revenue model. Semantic similarity doesn't capture these relationships. Full load lets the AI see the whole picture.

3. **Debugging is hard**: "Why didn't the AI remember X?" becomes a complex investigation of embeddings, thresholds, and query phrasing rather than a simple "does the fact exist?" check.

4. **False confidence from similarity scores**: A 0.82 similarity score feels authoritative but doesn't guarantee relevance. Threshold tuning is fragile and empirical.

5. **Added failure modes**: Embedding API availability, latency, index corruption, dimension mismatches—all new ways for things to break.

**Bottom line**: Vector search would make the AI *dumber* for business planning conversations, not smarter. The current approach of injecting all facts gives the AI complete context to make connections across the user's entire business model.

### When to Revisit

- If you add features where selective retrieval makes sense (e.g., "search my documents" or "find facts about X")
- If users consistently have 500+ facts and session performance degrades
- If you move to a model with smaller context windows

Until then, full load wins.

---

## References

- Existing codebase: `app/api/create-session/route.ts` (auth patterns)
- Supabase JS Client: https://supabase.com/docs/reference/javascript
- OpenAI ChatKit Sessions: https://platform.openai.com/docs/api-reference/chat (check for context injection)
- Outseta JWT structure: Check existing token decoding in codebase

---

*End of PRD*
