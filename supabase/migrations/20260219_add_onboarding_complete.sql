-- ============================================
-- Add onboarding_complete column to businesses table
-- ============================================
-- This migration adds tracking for user onboarding completion status.
-- The onboarding_complete field defaults to false and is set to true
-- when all onboarding milestones are completed.
-- ============================================

ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- RLS POLICY NOTE
-- ============================================
-- The existing RLS policies on the businesses table already allow
-- authenticated users to SELECT their own business records, which
-- includes the onboarding_complete field. No additional RLS policies
-- are required for this column.
-- ============================================
