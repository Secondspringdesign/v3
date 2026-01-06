---
layout: default
title: "Plan: Phase 1 Implementation"
permalink: /plan-phase1-implementation/
nav_exclude: true

doc_type: plan
doc_status: approved
doc_owner: "@engineering"
last_updated: 2026-01-06
related:
  - title: "PRD: Phase 1 Foundation"
    url: /secondspring-v3/spec-phase1-foundation/
  - title: "Backend Architecture Proposal"
    url: /secondspring-v3/design-backend-architecture/
---

# Phase 1 Foundation Implementation Plan
{: .no_toc }

| Field | Value |
|:------|:------|
| **Owner** | @engineering |
| **Status** | Approved |
| **Last Updated** | 2026-01-06 |
| **Epic** | `secondspring-v3-3lq` |
| **Related** | [PRD: Phase 1 Foundation](/secondspring-v3/spec-phase1-foundation/) |

> **Purpose**: Implementation plan for persistent fact storage using Supabase
> **Approach**: Service Layer Architecture (Option B)
> **Tracking**: 20 tasks in beads with dependencies

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Implement persistent fact storage for Second Spring using Supabase with a Service Layer Architecture.

**Approach**: Option B (Service Layer) - Clean separation with testable services

## Architecture

```
lib/
  supabase.ts                     # Supabase client singleton
  auth/
    jwt.ts                        # JWT verification (extracted from create-session)
    middleware.ts                 # Request authentication helper
  services/
    user.service.ts               # User CRUD + auto-creation
    business.service.ts           # Business CRUD
    fact.service.ts               # Fact CRUD + upsert
    memory.service.ts             # Memory formatting for AI
    index.ts                      # Re-exports
  types/
    database.ts                   # DB entity types
    api.ts                        # API request/response types
app/api/
  facts/route.ts                  # POST (upsert), GET (list)
  facts/[factId]/route.ts         # DELETE
  memory/route.ts                 # GET (formatted for AI)
supabase/
  migrations/001_foundation.sql   # Schema + RLS
```

## Key Decisions

| Decision | Choice | Rationale |
|:---------|:-------|:----------|
| Memory injection | `retrieve_memory` tool | AI calls it on startup; works with any ChatKit version |
| Error UX | Surface to user | When fact-saving fails, user sees error |
| Phase 2 prep | Include `documents` table | Empty placeholder in schema |
| Testing | Unit + Integration | Services get unit tests, API routes get integration tests |

## Implementation Tasks

### 1. Database Setup

| # | Task | File | Beads ID |
|:--|:-----|:-----|:---------|
| 1 | Create Supabase migration | `supabase/migrations/001_foundation.sql` | `secondspring-v3-ig7` |

Schema includes:
- `users` table (id, outseta_uid, email, timestamps)
- `businesses` table (id, user_id FK, name, status, timestamps)
- `facts` table (id, business_id FK, fact_id, fact_text, source_workflow, timestamps)
- `documents` table (Phase 2 placeholder)
- Unique constraint: `(business_id, fact_id)` for upsert
- `updated_at` trigger function
- RLS policies on all tables

### 2. Foundation Layer

| # | Task | File | Beads ID |
|:--|:-----|:-----|:---------|
| 2 | Create database types | `lib/types/database.ts` | `secondspring-v3-6e7` |
| 3 | Create API types | `lib/types/api.ts` | `secondspring-v3-msb` |
| 4 | Create Supabase client | `lib/supabase.ts` | `secondspring-v3-815` |
| 5 | Extract JWT auth | `lib/auth/jwt.ts` | `secondspring-v3-koj` |
| 6 | Create auth middleware | `lib/auth/middleware.ts` | `secondspring-v3-czs` |

### 3. Service Layer

| # | Task | File | Beads ID |
|:--|:-----|:-----|:---------|
| 7 | Create UserService | `lib/services/user.service.ts` | `secondspring-v3-aqb` |
| 8 | Create BusinessService | `lib/services/business.service.ts` | `secondspring-v3-c7i` |
| 9 | Create FactService | `lib/services/fact.service.ts` | `secondspring-v3-9sp` |
| 10 | Create MemoryService | `lib/services/memory.service.ts` | `secondspring-v3-1ia` |
| 11 | Create service exports | `lib/services/index.ts` | `secondspring-v3-cwc` |

### 4. API Routes

| # | Task | File | Beads ID |
|:--|:-----|:-----|:---------|
| 12 | Create facts route | `app/api/facts/route.ts` | `secondspring-v3-flq` |
| 13 | Create fact delete route | `app/api/facts/[factId]/route.ts` | `secondspring-v3-ukj` |
| 14 | Create memory route | `app/api/memory/route.ts` | `secondspring-v3-21a` |
| 15 | Refactor create-session | `app/api/create-session/route.ts` | `secondspring-v3-4rz` |

### 5. ChatKit Integration

| # | Task | File | Beads ID |
|:--|:-----|:-----|:---------|
| 16 | Update ChatKitPanel | `components/ChatKitPanel.tsx` | `secondspring-v3-jl6` |
| 17 | Add retrieve_memory tool | `components/ChatKitPanel.tsx` | `secondspring-v3-3sc` |

### 6. Configuration

| # | Task | Beads ID |
|:--|:-----|:---------|
| 18 | Configure environment variables | `secondspring-v3-dx3` |

### 7. Testing

| # | Task | Directory | Beads ID |
|:--|:-----|:----------|:---------|
| 19 | Service unit tests | `lib/services/__tests__/` | `secondspring-v3-6xp` |
| 20 | API integration tests | `app/api/__tests__/` | `secondspring-v3-82d` |

## Dependencies

```
1 (migration) ──┐
                ├──► 7-11 (services) ──► 12-14 (API routes)
2-6 (foundation)┘                               │
                                                ▼
                                    15-17 (integration)
                                                │
                                                ▼
                                         19-20 (tests)
```

Tasks that can be worked in parallel (no blockers):
- `secondspring-v3-ig7` - Create Supabase migration (P1)
- `secondspring-v3-6e7` - Create database types
- `secondspring-v3-msb` - Create API types
- `secondspring-v3-815` - Create Supabase client
- `secondspring-v3-koj` - Extract JWT auth module

## Critical Files

### To Modify
- `app/api/create-session/route.ts` - Extract JWT logic
- `components/ChatKitPanel.tsx` - API integration + retrieve_memory tool

### To Create
- `supabase/migrations/001_foundation.sql`
- `lib/supabase.ts`
- `lib/auth/jwt.ts`, `lib/auth/middleware.ts`
- `lib/types/database.ts`, `lib/types/api.ts`
- `lib/services/*.ts`
- `app/api/facts/route.ts`, `app/api/facts/[factId]/route.ts`
- `app/api/memory/route.ts`

## Environment Variables

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Never expose client-side
```

## Commands

```bash
# Check available work
bd ready

# Claim a task
bd update <id> --status=in_progress

# Complete a task
bd close <id>

# View epic status
bd show secondspring-v3-3lq
```
