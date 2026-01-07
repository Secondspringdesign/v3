---
layout: default
title: "Deploy: Phase 1 Foundation"
permalink: /deploy-phase1-foundation/
nav_exclude: true

doc_type: runbook
doc_status: ready
doc_owner: "@engineering"
last_updated: 2026-01-06
related:
  - title: "Plan: Phase 1 Implementation"
    url: /secondspring-v3/plan-phase1-implementation/
  - title: "PRD: Phase 1 Foundation"
    url: /secondspring-v3/spec-phase1-foundation/
---

# Phase 1 Foundation: Deployment Guide
{: .no_toc }

| Field | Value |
|:------|:------|
| **Owner** | @engineering |
| **Status** | Ready |
| **Last Updated** | 2026-01-06 |
| **Branch** | `feature/backend-initial` |
| **Changes** | 60 files, +9,798 / -712 lines |

> **Purpose**: Step-by-step deployment instructions for Phase 1 persistent fact storage
> **Prerequisites**: Supabase project, Vercel deployment, Supabase CLI installed
> **Roles**: Jon (CLI/migration), Christian (dashboard configuration)

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

This guide covers deploying the Phase 1 Foundation feature which adds:
- Persistent fact storage via Supabase (PostgreSQL)
- API routes for facts CRUD and memory retrieval
- ChatKit integration for `record_fact` and `retrieve_memory` tools

## Prerequisites

### Required Tools
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`brew install supabase/tap/supabase`)
- Git access to the repository
- Access to Supabase dashboard (Christian)
- Access to Vercel dashboard (Christian)

### Verify Supabase CLI
```bash
supabase --version
# Should output version 1.x or higher
```

---

## Step 1: Obtain Supabase Credentials (Christian)

### 1.1 Get Project Reference
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select the Second Spring project
3. Go to **Settings** → **General**
4. Copy the **Reference ID** (e.g., `abcdefghijklmnop`)

### 1.2 Get SUPABASE_URL
1. Go to **Settings** → **API**
2. Copy the **Project URL**
   - Format: `https://<project-ref>.supabase.co`
   - Example: `https://abcdefghijklmnop.supabase.co`

### 1.3 Get SUPABASE_SECRET_KEY
1. Go to **Settings** → **API**
2. Under **Secret keys**, copy (or create) a secret key
   - Format: `sb_secret_...`
   - This key bypasses RLS - never expose client-side
   - You can create multiple secret keys for zero-downtime rotation

> **Note**: Legacy `service_role` JWT keys are deprecated. New projects use `sb_secret_...` keys instead. See [Supabase API Keys Migration](https://github.com/orgs/supabase/discussions/29260) for details.

### 1.4 Share Credentials Securely
Share the following with Jon for CLI setup:
- Project Reference ID
- SUPABASE_URL
- SUPABASE_SECRET_KEY

Use a secure channel (1Password, encrypted message, etc.)

---

## Step 2: Run Database Migration (Jon)

### 2.1 Link Supabase Project
```bash
cd /path/to/secondspring-v3

# Link to the Supabase project
supabase link --project-ref <project-ref>

# You'll be prompted for the database password
# Get this from Christian (Settings → Database → Database password)
```

### 2.2 Verify Migration File
```bash
# Check the migration exists
ls -la supabase/migrations/
# Should show: 001_foundation.sql
```

### 2.3 Push Migration
```bash
# Push the migration to the linked project
supabase db push
```

This creates:
- `users` table (id, outseta_uid, email, timestamps)
- `businesses` table (id, user_id, name, status, timestamps)
- `facts` table (id, business_id, fact_id, fact_text, source_workflow, timestamps)
- `documents` table (Phase 2 placeholder)
- Row Level Security (RLS) policies
- `updated_at` trigger function

### 2.4 Verify Migration
```bash
# Check migration status
supabase db diff
# Should show no differences if migration applied successfully
```

Or verify in Supabase Dashboard:
1. Go to **Table Editor**
2. Confirm `users`, `businesses`, `facts`, `documents` tables exist

---

## Step 3: Configure Vercel Environment Variables (Christian)

### 3.1 Add Environment Variables
1. Go to [Vercel Dashboard](https://vercel.com)
2. Select the Second Spring project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

| Variable | Value | Environments |
|:---------|:------|:-------------|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Production, Preview, Development |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` (secret key) | Production, Preview, Development |

### 3.2 Redeploy
After adding environment variables:
1. Go to **Deployments**
2. Find the latest deployment
3. Click **...** → **Redeploy**

---

## Step 4: Configure ChatKit Tools (Christian)

### 4.1 Add retrieve_memory Tool
In the ChatKit dashboard, add a new client tool to the workflow(s):

**Tool Name**: `retrieve_memory`

**Description**: Retrieves the user's business memory context for personalization

**Parameters**: None required

**Returns**:
```json
{
  "success": true,
  "memory_context": "## Business Memory\n\n**Business Name**: ..."
}
```

### 4.2 Verify record_fact Tool
Ensure the existing `record_fact` tool is configured with:
- `fact_id` (string, required)
- `fact_text` (string, required)
- `source_workflow` (string, optional)

---

## Step 5: Merge and Deploy

### 5.1 Create Pull Request
```bash
# From the feature branch
gh pr create --title "feat: Phase 1 Foundation - Persistent Fact Storage" --body "$(cat <<'EOF'
## Summary
- Add Supabase backend for persistent fact storage
- Implement service layer (UserService, BusinessService, FactService, MemoryService)
- Add API routes for facts CRUD and memory retrieval
- Integrate ChatKit with record_fact and retrieve_memory tools
- Add 61 unit and integration tests

## Changes
60 files changed, +9,798 / -712 lines

## Test Plan
- [ ] Verify database migration applied successfully
- [ ] Test fact creation via ChatKit conversation
- [ ] Test memory retrieval on new conversation
- [ ] Verify user isolation (User A cannot see User B's facts)

## Documentation
- [Deployment Guide](/docs/deploy-phase1-foundation.md)
- [Implementation Plan](/docs/plan-phase1-implementation.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 5.2 Merge to Main
After PR approval, merge to main. Vercel will auto-deploy.

---

## Verification Checklist

After deployment, verify:

- [ ] Database tables exist in Supabase (`users`, `businesses`, `facts`, `documents`)
- [ ] RLS policies are enabled on all tables
- [ ] Environment variables are set in Vercel
- [ ] API routes respond:
  - `POST /api/facts` - Creates/updates facts
  - `GET /api/facts` - Lists user's facts
  - `DELETE /api/facts/:factId` - Deletes a fact
  - `GET /api/memory` - Returns formatted memory context
- [ ] ChatKit `record_fact` tool persists facts to database
- [ ] ChatKit `retrieve_memory` tool returns stored facts

---

## Rollback Procedure

If issues occur:

### Revert Code
```bash
# Revert the merge commit
git revert <merge-commit-sha>
git push origin main
```

### Revert Database (if needed)
```bash
# Create a down migration
supabase migration new rollback_foundation

# Add DROP statements to the new migration file
# Then push
supabase db push
```

### Remove Environment Variables
In Vercel dashboard, remove `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

---

## Troubleshooting

### Migration Fails
```bash
# Check migration status
supabase db diff

# View migration logs
supabase db push --debug
```

### API Returns 500
1. Check Vercel logs for errors
2. Verify environment variables are set correctly
3. Ensure Supabase project is accessible

### Facts Not Persisting
1. Check browser console for API errors
2. Verify Outseta token is being sent in requests
3. Check Supabase logs for RLS policy denials

---

## Contact

- **Technical Issues**: Jon
- **Dashboard Access**: Christian
- **Supabase Support**: https://supabase.com/support
