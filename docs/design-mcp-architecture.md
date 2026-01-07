---
layout: default
title: "MCP Architecture Evolution"
permalink: /design-mcp-architecture/
nav_exclude: true

doc_type: design
doc_status: proposed
doc_owner: "@engineering"
last_updated: 2026-01-07
related:
  - title: "Backend Architecture Proposal"
    url: /secondspring-v3/design-backend-architecture/
  - title: "Plan: Phase 1 Implementation"
    url: /secondspring-v3/plan-phase1-implementation/
---

# MCP Architecture Evolution
{: .no_toc }

| Field | Value |
|:------|:------|
| **Owner** | @engineering |
| **Status** | Proposed |
| **Last Updated** | 2026-01-07 |
| **Related** | [Backend Architecture](/secondspring-v3/design-backend-architecture/) |

> **Purpose:** Document the evolution from client-side tools to MCP (Model Context Protocol) server architecture for agent-database communication.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

This document describes the architectural evolution of how Second Spring agents access user data:

- **Phase 1 (Current):** Client-side tools that route through browser to API routes
- **Phase 2 (Future):** MCP server providing direct agent-to-database communication

The key insight from Ian: *"Getting user info into the agent builder flows as context is the most important piece. Anything after that is just regular db queries."*

---

## Motivation

### Problem Statement

Agents need access to user context (facts, business info, documents) to provide personalized experiences. The current implementation works but has limitations:

1. **Indirection**: Agent → ChatKit → Browser → API → Database (multiple hops)
2. **Limited flexibility**: Client tools have fixed parameters; can't do ad-hoc queries
3. **Coupling**: Every new data access pattern requires client-side code changes

### User Stories

- As an agent, I want to query specific facts so that I can answer targeted questions without loading all context.
- As an agent, I want to search across documents so that I can reference previous work.
- As a developer, I want to add new data access patterns without modifying client code.

---

## Goals and Non-Goals

### Goals

- Document current architecture (Phase 1)
- Propose MCP-based architecture (Phase 2)
- Provide clear migration path between phases
- Enable richer agent-database interactions

### Non-Goals

- CRM integration (optional future work, not designed here)
- Real-time sync between agents
- Multi-agent coordination

---

## Current Architecture (Phase 1)

### Overview

```
┌─────────────┐                           ┌─────────────────────────┐
│    User     │                           │        ChatKit          │
│  (Browser)  │                           │   (Agent Builder AI)    │
└──────┬──────┘                           └───────────┬─────────────┘
       │                                              │
       │ 1. Sends UserInfo                            │ 4. Calls client tool
       ▼                                              │    (retrieve_memory)
┌─────────────────────────────────────────────────────▼─────────────────┐
│                         ChatKitPanel.tsx                              │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  onClientTool handler                                           │  │
│  │  • retrieve_memory → GET /api/memory                            │  │
│  │  • record_fact     → POST /api/facts                            │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │
                                    │ 5. HTTP request with Outseta JWT
                                    ▼
                          ┌─────────────────┐
                          │  Vercel Edge    │
                          │   API Routes    │
                          │  /api/memory    │
                          │  /api/facts     │
                          └────────┬────────┘
                                   │
                                   │ 6. Query with user context
                                   ▼
                          ┌─────────────────┐
                          │    Supabase     │
                          │   (Postgres)    │
                          └─────────────────┘
```

### Data Flow

1. User authenticates via Outseta (JWT token stored in browser)
2. ChatKit loads with user context
3. Agent receives session payload
4. Agent calls `retrieve_memory` tool to get user context
5. ChatKit invokes `onClientTool` handler in browser
6. Handler calls `/api/memory` with Authorization header
7. API route authenticates, queries Supabase, returns formatted context
8. Agent uses context to personalize responses

### Components

#### Client Tools (ChatKitPanel.tsx)

| Tool | Purpose | API Route |
|:-----|:--------|:----------|
| `retrieve_memory` | Load all user facts as formatted context | `GET /api/memory` |
| `record_fact` | Save a new fact about the user's business | `POST /api/facts` |
| `switch_theme` | Change UI theme (light/dark) | N/A (client-only) |

#### API Routes

| Route | Method | Purpose |
|:------|:-------|:--------|
| `/api/memory` | GET | Returns formatted facts for AI context |
| `/api/facts` | POST | Upsert a fact |
| `/api/facts` | GET | List all facts for user |
| `/api/facts/[id]` | DELETE | Delete a specific fact |

### Limitations

1. **All-or-nothing context**: `retrieve_memory` loads everything; no filtering
2. **Fixed schema**: Adding new tools requires code changes in both ChatKit dashboard and client handler
3. **Browser dependency**: Tools only work when browser is active
4. **No direct queries**: Agent can't ask "what facts mention revenue?"

---

## Proposed Architecture (Phase 2)

### Overview

Add an MCP (Model Context Protocol) server between agents and the database:

```
┌─────────────┐                           ┌─────────────────────────┐
│    User     │                           │        Agent            │
│  (Browser)  │                           │   (ChatKit/Builder)     │
└──────┬──────┘                           └───────────┬─────────────┘
       │                                              │
       │ Sends UserInfo                               │ Calls MCP tools directly
       ▼                                              ▼
┌─────────────────┐                       ┌─────────────────────────┐
│  ChatKitPanel   │                       │      MCP Server         │
│  (UI layer)     │                       │  ┌─────────────────┐    │
└─────────────────┘                       │  │ query_facts     │    │
                                          │  │ search_facts    │    │
                                          │  │ get_business    │    │
                                          │  │ list_documents  │    │
                                          │  │ read_document   │    │
                                          │  └─────────────────┘    │
                                          └───────────┬─────────────┘
                                                      │
              ┌───────────────────────────────────────┤
              │                                       │
              ▼                                       ▼
    ┌─────────────────┐                     ┌─────────────────┐
    │  PDF MCP Server │                     │    Supabase     │
    │  (future)       │                     │   (Postgres)    │
    └─────────────────┘                     └─────────────────┘
```

### MCP Server Tools

| Tool | Purpose | Parameters |
|:-----|:--------|:-----------|
| `query_facts` | Get facts with optional filtering | `filter?: string`, `limit?: number` |
| `search_facts` | Full-text search across facts | `query: string` |
| `get_business` | Get current business info | None |
| `list_documents` | List available documents | `type?: string` |
| `read_document` | Read a specific document | `document_id: string` |
| `save_fact` | Save/update a fact | `fact_id: string`, `fact_text: string` |

### Benefits

1. **Direct access**: Agent calls MCP server directly, no browser intermediary
2. **Rich queries**: Can filter, search, and paginate results
3. **Extensible**: New tools added to MCP server without client changes
4. **Reusable**: Same MCP server works across different agent platforms
5. **Auditable**: MCP server can log all agent data access

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │────▶│ MCP Server  │────▶│  Supabase   │
│ (with user  │     │ (validates  │     │  (queries   │
│  context)   │     │  context)   │     │   data)     │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       │ User context passed from
       │ ChatKit session creation
       ▼
┌─────────────┐
│  Outseta    │
│  (source    │
│  of truth)  │
└─────────────┘
```

The MCP server receives user context (outseta_uid) from the agent's session context, not from browser auth.

---

## Comparison

| Aspect | Phase 1 (Client Tools) | Phase 2 (MCP Server) |
|:-------|:----------------------|:--------------------|
| **Location** | Browser handles tool calls | Server-side MCP |
| **Auth** | Outseta JWT → API routes | Agent session context |
| **Flexibility** | Fixed tool parameters | Dynamic queries |
| **Latency** | Higher (browser hop) | Lower (direct) |
| **Setup** | Simpler | Requires MCP infrastructure |
| **Tool changes** | Requires client code | MCP server only |
| **Offline support** | No | Possible |

---

## Implementation Plan

### Phase 1: Foundation (Current)

- [x] Supabase schema with users, businesses, facts tables
- [x] API routes for facts CRUD and memory retrieval
- [x] Client tools: `retrieve_memory`, `record_fact`
- [x] ChatKit integration

### Phase 2: MCP Server

- [ ] Design MCP server interface
- [ ] Implement core MCP server with Supabase connection
- [ ] Add `query_facts` tool with filtering
- [ ] Add `search_facts` tool with full-text search
- [ ] Configure agent to use MCP server
- [ ] Migrate from client tools to MCP tools
- [ ] Deprecate client-side tool handlers

### Phase 3: Extended Capabilities (Future)

- [ ] Add PDF MCP server for document processing
- [ ] Add `list_documents` / `read_document` tools
- [ ] CRM integration (optional)
- [ ] Multi-business support

### Dependencies

| Dependency | Owner | Status |
|:-----------|:------|:-------|
| Phase 1 deployment | @engineering | In progress |
| MCP server hosting | TBD | Not started |
| Agent Builder MCP support | @ian | To be confirmed |

---

## Technical Considerations

### MCP Protocol

MCP (Model Context Protocol) is a standard for AI agents to communicate with external services. Key concepts:

- **Tools**: Functions the agent can call
- **Resources**: Data the agent can read
- **Context**: Information about the current user/session

### Security

- MCP server validates user context before any database access
- All queries scoped to authenticated user's business
- Audit logging for data access
- No direct SQL exposure to agents

### Performance

- MCP server can cache frequently accessed data
- Pagination for large result sets
- Connection pooling for Supabase

---

## Open Questions

- [ ] Where will the MCP server be hosted? (Vercel Edge Function, separate service?)
- [ ] How does Agent Builder pass user context to MCP servers?
- [ ] Should we support both client tools and MCP tools during migration?
- [ ] What's the timeline for Agent Builder MCP support?

---

## Changelog

| Date | Author | Change |
|:-----|:-------|:-------|
| 2026-01-07 | @engineering | Initial proposal based on team discussion |

