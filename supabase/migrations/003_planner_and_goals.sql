-- ============================================
-- Second Spring - Planner and Goals
-- ============================================
-- Adds tables for the Planner and Goals sections
-- of the Business Hub UI (Figma Make v47).
-- ============================================

-- ============================================
-- PILLARS
-- Shared workflow/domain tags for planner and goals
-- ============================================
CREATE TABLE pillars (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    color         TEXT,
    icon          TEXT,
    display_order INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pillars (id, name, color, icon, display_order) VALUES
    ('business',  'Business',  'blue',   'sparkles',  1),
    ('product',   'Product',   'purple', 'target',    2),
    ('marketing', 'Marketing', 'green',  'megaphone', 3),
    ('money',     'Money',     'yellow', 'dollar',    4);

-- ============================================
-- PLANNER
-- Actionable items grouped by time period
-- ============================================
CREATE TABLE planner (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    due_date        DATE,
    due_period      TEXT NOT NULL CHECK (due_period IN ('today', 'this_week', 'next_week')),
    pillar_id       TEXT REFERENCES pillars(id),
    completed       BOOLEAN DEFAULT false,
    completed_at    TIMESTAMPTZ,
    sort_order      INT DEFAULT 0,
    source_workflow TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_planner_business ON planner(business_id);
CREATE INDEX idx_planner_business_period ON planner(business_id, due_period) WHERE completed = false;
CREATE INDEX idx_planner_business_due_date ON planner(business_id, due_date) WHERE completed = false;

-- ============================================
-- GOALS
-- Aspirational targets grouped by time horizon
-- ============================================
CREATE TABLE goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    time_horizon    TEXT NOT NULL CHECK (time_horizon IN ('this_week', 'this_month', 'this_quarter')),
    pillar_id       TEXT REFERENCES pillars(id),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'archived')),
    achieved_at     TIMESTAMPTZ,
    sort_order      INT DEFAULT 0,
    source_workflow TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goals_business ON goals(business_id);
CREATE INDEX idx_goals_business_horizon ON goals(business_id, time_horizon) WHERE status = 'active';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Pillars: read-only lookup for all authenticated users
ALTER TABLE pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE pillars FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pillars"
    ON pillars FOR SELECT
    USING (true);

-- Planner: users access planner items via their business
ALTER TABLE planner ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users access own planner items"
    ON planner FOR ALL
    USING (
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN users u ON b.user_id = u.id
            WHERE u.outseta_uid = current_setting('app.current_user_id', true)
        )
    );

-- Goals: users access goals via their business
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users access own goals"
    ON goals FOR ALL
    USING (
        business_id IN (
            SELECT b.id FROM businesses b
            JOIN users u ON b.user_id = u.id
            WHERE u.outseta_uid = current_setting('app.current_user_id', true)
        )
    );

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER planner_updated_at
    BEFORE UPDATE ON planner
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
