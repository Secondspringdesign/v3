---
layout: default
title: "Deployment Strategy: Pre-Release Testing"
permalink: /spec-deployment-strategy/
nav_order: 15

doc_type: spec
doc_status: proposed
doc_owner: "@jon"
last_updated: 2025-01-07
related:
  - title: "Phase 1 Deployment Guide"
    url: /secondspring-v3/deploy-phase1-foundation/
  - title: "Backend Architecture"
    url: /secondspring-v3/design-backend-architecture/
---

# Deployment Strategy: Pre-Release Testing Environment

| Field | Value |
|:------|:------|
| **Owner** | @jon |
| **Status** | Proposed |
| **Last Updated** | 2025-01-07 |

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

Add a staging environment using Vercel branch deployments and **two separate Supabase projects** (staging + production) for complete schema isolation. This enables pre-release validation of code and database migrations before production deployment.

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
- Keep costs at $0/month (use free tiers)
- Automate migration deployment via GitHub Actions

## Non-Goals

- Multi-region deployment
- Blue-green deployment or canary releases
- Database branching (requires Supabase Pro)

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

### Database Strategy: Two Supabase Projects

| Project | Purpose | Migrations Applied |
|:--------|:--------|:-------------------|
| `secondspring-staging` | Pre-release validation | On merge to `staging` |
| `secondspring-prod` | Production | On merge to `main` |

**Benefits**:
- Complete schema isolation (migrations tested before production)
- Free tier for both projects ($0/month)
- No risk of staging changes affecting production

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

### Phase 1: Supabase Setup (Manual - Christian)

- [ ] Create new Supabase project: `secondspring-staging`
- [ ] Note staging credentials (URL, secret key)
- [ ] Apply existing migrations to staging: `supabase db push`

### Phase 2: Branch Setup (Manual - Jon)

- [ ] Create `staging` branch from `main`
- [ ] Configure GitHub branch protection:
  - `main`: Require PR, require status checks
  - `staging`: Require PR, require status checks

### Phase 3: Vercel Configuration (Manual)

- [ ] Add `staging` as protected preview branch
- [ ] Configure environment variables:

**Production scope** (main branch):
```
SUPABASE_URL=https://<prod-ref>.supabase.co
SUPABASE_SECRET_KEY=<prod-secret>
```

**Preview scope** (staging + feature branches):
```
SUPABASE_URL=https://<staging-ref>.supabase.co
SUPABASE_SECRET_KEY=<staging-secret>
SUPABASE_STUB_MODE=false
```

**Override for feature branches** (optional):
```
SUPABASE_STUB_MODE=true
```

### Phase 4: GitHub Actions Enhancement

- [ ] Update `.github/workflows/ci.yml`:
  - Add `npm run test` job
  - Add migration validation (local Supabase)
- [ ] Create `.github/workflows/staging-deploy.yml`:
  - Trigger: push to `staging`
  - Action: Apply migrations to staging Supabase
- [ ] Create `.github/workflows/production-deploy.yml`:
  - Trigger: push to `main`
  - Action: Apply migrations to production Supabase
- [ ] Add GitHub secrets:
  - `SUPABASE_STAGING_PROJECT_REF`
  - `SUPABASE_STAGING_DB_PASSWORD`
  - `SUPABASE_PROD_PROJECT_REF`
  - `SUPABASE_PROD_DB_PASSWORD`
  - `SUPABASE_ACCESS_TOKEN`

### Phase 5: Documentation

- [ ] Update `docs/deploy-phase1-foundation.md` with staging workflow
- [ ] Update `.env.example` with staging variables
- [ ] Create staging verification checklist

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

### GitHub Actions: staging-deploy.yml (New)

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
      - run: supabase link --project-ref ${{ secrets.SUPABASE_STAGING_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_STAGING_DB_PASSWORD }}
      - run: supabase db push
```

### GitHub Actions: production-deploy.yml (New)

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
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROD_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_PROD_DB_PASSWORD }}
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
| Supabase | $0/mo (1 project) | $0/mo (2 projects, free tier) |
| GitHub Actions | $0/mo | $0/mo |
| **Total** | **$0-20/mo** | **$0-20/mo** |

{: .note }
> Supabase free tier allows 2 projects. Both staging and production fit within this limit.

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
- **Why rejected**: User correctly identified that DDL changes would affect production

### Alternative 2: Supabase Database Branching

- **Pros**: Best isolation, automatic schema sync
- **Cons**: Requires Pro plan ($25/month)
- **Why rejected**: Cost; free tier preferred

---

## Changelog

| Date | Author | Change |
|:-----|:-------|:-------|
| 2025-01-07 | @jon | Initial proposal |
