---
layout: default
title: "Deployment Strategy: Pre-Release Testing"
permalink: /spec-deployment-strategy/
nav_order: 15

doc_type: spec
doc_status: proposed
doc_owner: "@jon"
last_updated: 2026-01-08
related:
  - title: "Phase 1 Deployment Guide"
    url: /v3/deploy-phase1-foundation/
  - title: "Backend Architecture"
    url: /v3/design-backend-architecture/
---

# Deployment Strategy: Pre-Release Testing Environment

| Field | Value |
|:------|:------|
| **Owner** | @jon |
| **Status** | Proposed |
| **Last Updated** | 2026-01-08 |

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

Add a staging environment using Vercel branch deployments and **Supabase native branching** (Pro plan) for complete schema isolation. This enables pre-release validation of code and database migrations before production deployment.

---

## Current State

| Component | Current Setup |
|:----------|:--------------|
| Hosting | Vercel (auto-deploy on push to `main`) |
| Database | Supabase (single project) |
| CI | GitHub Actions (lint + build only) |
| Auth | Outseta (JWT) |
| Environments | Production only |

**Problem**: Push to `main` = immediate production deployment with no pre-release validation.

---

## Goals

- Validate code changes in a staging environment before production
- Test database migrations against staging database first
- Maintain schema isolation between staging and production
- Leverage Supabase Pro branching for native database isolation
- Automate migration deployment via GitHub Actions

## Non-Goals

- Multi-region deployment
- Blue-green deployment or canary releases
- Ephemeral preview branches per PR (future enhancement)

---

## Naming Convention

**Pattern:** `secondspring` + `-{environment}` suffix

| Component | Production | Staging |
|:----------|:-----------|:--------|
| **Git branch** | `main` | `staging` |
| **Vercel domain** | `secondspring.vercel.app` | `secondspring-staging.vercel.app` |
| **Supabase branch** | Main (default) | `staging` (persistent) |
| **GitHub secrets** | `SUPABASE_PROJECT_REF` | (same project) |

**Auth (Outseta):** Shared account for both environments. Add `secondspring-staging.vercel.app` to Outseta's allowed callback URLs.

{: .note }
> When a custom domain is added later (e.g., `secondspring.design`), staging would become `staging.secondspring.design`.

---

## Proposed Design

### Branch Structure

```
main (production) ← staging (pre-release) ← feature/* (development)
```

| Branch | Vercel Environment | Database | Purpose |
|:-------|:------------------|:---------|:--------|
| `main` | Production | Production Supabase | Live users |
| `staging` | Preview (protected) | Staging Supabase | Pre-release testing |
| `feature/*` | Preview (ephemeral) | Stub mode | Development/review |

### Database Strategy: Supabase Native Branching (Pro Plan)

| Branch | Type | Purpose | Lifecycle |
|:-------|:-----|:--------|:----------|
| Main | Default | Production | Permanent |
| `staging` | Persistent | Pre-release validation | Long-lived |
| (Future) | Preview | PR previews | Auto-created/deleted |

**Benefits**:
- Single project, unified billing
- Complete schema isolation between branches
- Migrations auto-applied to branches
- Each branch gets its own API credentials
- Optional GitHub integration for auto preview branches per PR

### Deployment Flow

```
1. Feature branch → PR → Vercel preview (stub mode, no DB)
2. CI validates: lint, tests, migration syntax
3. Merge to staging → Migrations auto-apply to staging Supabase
4. Test on staging preview (real DB, real data)
5. Merge staging to main → Migrations apply to production Supabase
6. Production deployment
```

{: .note }
> Future optimization: Limit Vercel builds to only `main` and `staging` branches to save build minutes.

---

## Implementation Plan

### Phase 1: Supabase Branching Setup (Manual)

- [ ] Enable branching in Supabase dashboard (Project Settings → Branching)
- [ ] Create persistent branch named `staging`
- [ ] Note staging branch credentials (URL, anon key, service key)

### Phase 2: Branch Setup (Manual - Jon)

- [ ] Create `staging` branch from `main`
- [ ] Configure GitHub branch protection:
  - `main`: Require PR, require status checks
  - `staging`: Require PR, require status checks

### Phase 3: Vercel Configuration (Manual)

- [ ] Configure domains:
  - Production: `secondspring.vercel.app` → `main` branch
  - Staging: `secondspring-staging.vercel.app` → `staging` branch
- [ ] Configure environment variables:

**Production scope** (main branch):
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<main-branch-secret-api-key>
```

**Preview scope** (staging branch):
```
SUPABASE_URL=https://<project-ref>-staging.<region>.supabase.co
SUPABASE_SECRET_KEY=<staging-branch-secret-api-key>
SUPABASE_STUB_MODE=false
```

{: .important }
> Use the new Supabase key naming: **Publishable API key** (client-side) and **Secret API key** (server-side). Do not use legacy `anon`/`service_role` keys.

**Override for feature branches** (optional):
```
SUPABASE_STUB_MODE=true
```

{: .note }
> With Supabase branching, each branch has its own URL and credentials. The staging branch URL includes the branch name.

### Phase 4: GitHub Actions Enhancement

- [x] Update `.github/workflows/ci.yml`:
  - Add `npm run test` job
  - Add migration validation (local Supabase)
- [x] Create `.github/workflows/staging-deploy.yml`:
  - Trigger: push to `staging`
  - Action: Apply migrations to staging branch
- [x] Create `.github/workflows/production-deploy.yml`:
  - Trigger: push to `main`
  - Action: Apply migrations to production
- [ ] Add GitHub secrets (simplified with native branching):
  - `SUPABASE_PROJECT_REF` (single project for both environments)
  - `SUPABASE_DB_PASSWORD` (main branch password)
  - `SUPABASE_ACCESS_TOKEN`

### Phase 5: Outseta Configuration (Manual)

- [ ] Add `https://secondspring-staging.vercel.app` to Outseta allowed callback URLs
- [ ] Verify JWT validation works for both domains

### Phase 6: Documentation

- [x] Update `docs/deploy-phase1-foundation.md` with staging workflow
- [x] Update `.env.example` with staging variables
- [x] Create staging verification checklist (see Verification Checklist section)

---

## Technical Details

### GitHub Actions: ci.yml (Enhanced)

```yaml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:

jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
        env:
          SUPABASE_STUB_MODE: "true"
      - run: npm run build

  migration-check:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase db push --local
```

### GitHub Actions: staging-deploy.yml

```yaml
name: Staging Deploy

on:
  push:
    branches: [staging]

jobs:
  apply-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      # With Supabase native branching + GitHub integration,
      # migrations are auto-applied. This is a fallback.
      - run: supabase db push
```

### GitHub Actions: production-deploy.yml

```yaml
name: Production Deploy

on:
  push:
    branches: [main]

jobs:
  apply-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      - run: supabase db push
```

---

## Files to Create/Modify

| File | Action | Description |
|:-----|:-------|:------------|
| `.github/workflows/ci.yml` | Modify | Add tests, migration validation |
| `.github/workflows/staging-deploy.yml` | Create | Apply migrations to staging |
| `.github/workflows/production-deploy.yml` | Create | Apply migrations to production |
| `.env.example` | Modify | Document staging variables |
| `docs/deploy-phase1-foundation.md` | Modify | Add staging workflow |

---

## Cost Analysis

| Service | Current | After |
|:--------|:--------|:------|
| Vercel | $0-20/mo | $0-20/mo |
| Supabase | $25/mo (Pro) | $25/mo (Pro with branching) |
| GitHub Actions | $0/mo | $0/mo |
| **Total** | **$25-45/mo** | **$25-45/mo** |

{: .note }
> Supabase Pro includes native branching. Branch compute usage within 8GB included in plan.

---

## Verification Checklist (Post-Implementation)

- [ ] Feature branch PR creates Vercel preview (stub mode)
- [ ] Merge to staging triggers migration to staging Supabase
- [ ] Staging preview connects to staging database
- [ ] Merge to main triggers migration to production Supabase
- [ ] Production deployment uses production database

---

## Alternatives Considered

### Alternative 1: Single Supabase Project with Test Accounts

- **Pros**: Simpler setup, one set of credentials
- **Cons**: Schema changes affect production immediately; no migration testing
- **Why rejected**: DDL changes would affect production users

### Alternative 2: Two Separate Supabase Projects (Free Tier)

- **Pros**: Complete isolation, $0/month
- **Cons**: Manual migration sync, separate credentials to manage
- **Why rejected**: Upgraded to Pro plan; native branching is simpler

### Chosen: Supabase Native Branching (Pro Plan)

- **Pros**: Best isolation, automatic schema sync, single project management, integrated with GitHub
- **Cons**: Requires Pro plan ($25/month)
- **Why chosen**: Cleaner architecture, fewer secrets, better DX

---

## Changelog

| Date | Author | Change |
|:-----|:-------|:-------|
| 2026-01-08 | @jon | Revised for Supabase Pro native branching |
| 2025-01-08 | @jon | Added naming convention, Outseta config phase |
| 2025-01-07 | @jon | Initial proposal |
