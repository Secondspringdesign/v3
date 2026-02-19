-- ============================================
-- Second Spring - Facts Schema v2
-- Lookup tables for fact categories and types
-- ============================================
-- Adds structured taxonomy to facts based on
-- Business Hub UI design (Figma Make v47).
-- See: docs/proposal-facts-schema-v2.md
-- ============================================

-- ============================================
-- FACT CATEGORIES
-- Groups related fact types for UI display
-- ============================================
CREATE TABLE fact_categories (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    icon          TEXT,
    display_order INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO fact_categories (id, name, description, icon, display_order) VALUES
    ('business',  'Business',  'Core identity and context for the venture',           'sparkles',  1),
    ('offer',     'Offer',     'What you sell, how you price it, and why it matters',  'target',    2),
    ('marketing', 'Marketing', 'Brand foundations, channels, and early experiments',   'megaphone', 3),
    ('money',     'Money',     'Revenue targets, costs, and financial structure',      'dollar',    4),
    ('custom',    'Custom',    'User-defined facts',                                  'building',  5);

-- ============================================
-- FACT TYPES
-- Specific facts that can be stored per business
-- ============================================
CREATE TABLE fact_types (
    id            TEXT PRIMARY KEY,
    category_id   TEXT NOT NULL REFERENCES fact_categories(id),
    name          TEXT NOT NULL,
    description   TEXT,
    display_order INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ----- Business -----
INSERT INTO fact_types (id, category_id, name, description, display_order) VALUES
    ('business_name',    'business', 'Business Name',    'The name of the venture',                              1),
    ('mission',          'business', 'Mission',          'Core purpose or mission statement',                    2),
    ('target_customer',  'business', 'Target Customer',  'Who the product or service is for',                    3),
    ('location',         'business', 'Location',         'Where the business is based',                          4),
    ('founding_date',    'business', 'Founding Date',    'When the business was started',                        5),
    ('team_size',        'business', 'Team Size',        'Number of people on the team',                         6);

-- ----- Offer -----
INSERT INTO fact_types (id, category_id, name, description, display_order) VALUES
    ('offer_summary',    'offer', 'Offer Summary',      'Short description of what you sell',                    1),
    ('pricing_model',    'offer', 'Pricing Model',      'How the product or service is priced',                  2),
    ('value_proposition','offer', 'Value Proposition',   'Why customers should choose this over alternatives',   3),
    ('offer_revenue_goal','offer','Revenue Goal',        'Revenue target tied to this offer',                    4);

-- ----- Marketing -----
INSERT INTO fact_types (id, category_id, name, description, display_order) VALUES
    ('brand_voice',      'marketing', 'Voice',           'How the brand sounds when it communicates',            1),
    ('brand_tone',       'marketing', 'Tone',            'The emotional quality of brand communication',         2),
    ('brand_messaging',  'marketing', 'Messaging',       'Key messages and positioning statements',              3),
    ('brand_personality','marketing', 'Personality',      'Brand character traits and attributes',                4),
    ('channels',         'marketing', 'Channels',        'Where you reach and engage customers',                 5),
    ('first_experiments','marketing', 'First Experiments','Initial marketing tests and learnings',                6);

-- ----- Money -----
INSERT INTO fact_types (id, category_id, name, description, display_order) VALUES
    ('revenue_goal',     'money', 'Revenue Goal',        'Overall revenue target for the business',              1),
    ('startup_costs',    'money', 'Startup Costs',       'Initial capital required to launch',                   2),
    ('monthly_burn',     'money', 'Monthly Burn',        'Recurring monthly expenses',                           3),
    ('revenue_streams',  'money', 'Revenue Streams',     'Sources of income for the business',                   4);

-- ============================================
-- MIGRATE FACTS TABLE
-- ============================================

-- Step 1: Add new column with FK
ALTER TABLE facts ADD COLUMN fact_type_id TEXT REFERENCES fact_types(id);

-- Step 2: Migrate existing data
-- Map existing fact_id values that match fact_type ids directly
UPDATE facts SET fact_type_id = fact_id
    WHERE fact_id IN (SELECT id FROM fact_types);

-- Flag unmapped rows — review before dropping
-- Uncomment the next line to assign orphans to a catch-all:
-- UPDATE facts SET fact_type_id = 'business_name' WHERE fact_type_id IS NULL;

-- Step 3: Rename columns for clarity
ALTER TABLE facts RENAME COLUMN fact_text TO fact_value;

-- Step 4: Enforce NOT NULL once all rows are mapped
-- NOTE: Only run after verifying no NULLs remain in fact_type_id
--   SELECT count(*) FROM facts WHERE fact_type_id IS NULL;
-- ALTER TABLE facts ALTER COLUMN fact_type_id SET NOT NULL;

-- Step 5: Drop old column once migration is confirmed
-- ALTER TABLE facts DROP COLUMN fact_id;

-- Step 6: Add unique constraint on new column
-- ALTER TABLE facts ADD CONSTRAINT facts_business_type_unique UNIQUE (business_id, fact_type_id);

-- ============================================
-- RLS for new lookup tables
-- Lookup tables are read-only for all authenticated users
-- ============================================
ALTER TABLE fact_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE fact_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE fact_types FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fact categories"
    ON fact_categories FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read fact types"
    ON fact_types FOR SELECT
    USING (true);

-- ============================================
-- UPDATED_AT TRIGGER for fact_types
-- (fact_categories are static, no trigger needed)
-- ============================================
CREATE TRIGGER fact_types_updated_at
    BEFORE UPDATE ON fact_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
