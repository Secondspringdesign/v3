-- ============================================
-- Add New Fact Types for Onboarding Flow
-- ============================================
-- Adds three new fact types to the business category
-- for the redesigned onboarding experience:
-- - why_this_business: Emotional motivation
-- - constraints_summary: Reality check (time, money, situation)
-- - first_experiment: The first small test to try
-- ============================================

INSERT INTO fact_types (id, category_id, name, description, display_order) VALUES
  ('why_this_business', 'business', 'Why This Business', 'Why do you want to do this? The emotional driver and motivation.', 8),
  ('constraints_summary', 'business', 'Constraints & Reality', 'What do you have to work with? Time, money, situation, limitations.', 9),
  ('first_experiment', 'business', 'First Experiment', 'The ONE small thing you will try first to test this idea.', 10)
ON CONFLICT (id) DO NOTHING;
