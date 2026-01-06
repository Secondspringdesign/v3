-- ============================================
-- Second Spring - Phase 1 Foundation Schema
-- ============================================
-- This migration creates the foundation tables for persistent fact storage.
-- Run in Supabase SQL Editor or via CLI.
-- ============================================

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
-- DOCUMENTS (Phase 2 Placeholder)
-- Business plans, SWOTs, reality checks
-- ============================================
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    document_type   TEXT NOT NULL,
    title           TEXT,
    content         JSONB,
    version         INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_business ON documents(business_id);

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

CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- Enable RLS on all tables (defense in depth)
-- API uses service role key, but RLS configured
-- for potential future direct client access
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

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

-- POLICY: Users can only access documents for their businesses
CREATE POLICY "Users access own documents"
    ON documents FOR ALL
    USING (
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN users u ON b.user_id = u.id
            WHERE u.outseta_uid = current_setting('app.current_user_id', true)
        )
    );

-- ============================================
-- SERVICE ROLE BYPASS
-- Allow service role to bypass RLS for API access
-- ============================================

ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE facts FORCE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

-- Grant full access to service role (bypasses RLS by default)
-- No additional grants needed - service_role has superuser-like access
