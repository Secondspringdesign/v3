---
layout: default
title: "API Versioning Specification"
permalink: /examples/spec-api-versioning/
nav_exclude: true

doc_type: spec
doc_status: accepted
doc_owner: "@platform-team"
last_updated: 2025-01-06
related:
  - title: "Design: API Gateway"
    url: /secondspring-v3/design-api-gateway/
---

# API Versioning Specification
{: .no_toc }

| Field | Value |
|:------|:------|
| **Owner** | @platform-team |
| **Status** | Accepted |
| **Last Updated** | 2025-01-06 |
| **Related** | [API Gateway Design](/secondspring-v3/design-api-gateway/) |

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

This specification defines the API versioning strategy for all public and internal APIs. It establishes conventions for version numbering, deprecation policies, and client migration paths.

---

## Goals

- Provide clear versioning semantics for API consumers
- Enable backwards-compatible evolution of APIs
- Establish predictable deprecation timelines
- Minimize client disruption during version transitions

### Non-Goals

- Defining specific API endpoints (covered in individual API specs)
- Internal service-to-service versioning (separate internal spec)

---

## Background

Our API has grown organically, with inconsistent versioning approaches across teams. Some APIs use URL path versioning (`/v1/`), others use headers, and some have no versioning. This causes confusion for clients and complicates deprecation.

---

## Specification

### Definitions

| Term | Definition |
|:-----|:-----------|
| Major Version | Breaking changes to request/response format or behavior |
| Minor Version | Backwards-compatible additions (new fields, endpoints) |
| Deprecated | Marked for removal; still functional but discouraged |
| Sunset | Removal date after which the version returns 410 Gone |

### Requirements

#### Functional Requirements

1. **REQ-001**: All public APIs MUST include a version identifier in the URL path as `/api/v{major}/`.
2. **REQ-002**: Version numbers MUST be positive integers starting from 1.
3. **REQ-003**: The API MUST return a `X-API-Version` response header indicating the served version.
4. **REQ-004**: Deprecated versions MUST return a `Deprecation` header with the sunset date.
5. **REQ-005**: After sunset, the API MUST return 410 Gone with a migration guide link.

{: .note }
> Minor versions are not exposed in URLs. Backwards-compatible changes are released continuously.

#### Non-Functional Requirements

1. **NFR-001**: Version routing overhead MUST NOT exceed 1ms p99 latency.
2. **NFR-002**: At least 2 major versions MUST be supported simultaneously.

### Version Lifecycle

```
┌─────────┐     ┌────────────┐     ┌───────────┐     ┌────────┐
│ Current │────▶│ Deprecated │────▶│  Sunset   │────▶│ Removed│
└─────────┘     └────────────┘     └───────────┘     └────────┘
    │                 │                  │
    │            6 months           12 months
    │           min notice          min notice
```

### Deprecation Policy

| Phase | Duration | Client Impact |
|:------|:---------|:--------------|
| Current | Indefinite | Full support |
| Deprecated | Minimum 6 months | Deprecation headers; support continues |
| Sunset | 30 days notice | Read-only; returns 410 after sunset |
| Removed | N/A | 410 Gone with migration link |

---

## Security Considerations

- Version identifiers MUST NOT leak internal implementation details
- Sunset versions MUST still enforce authentication to prevent enumeration

---

## Compatibility

### Breaking Changes

Moving from unversioned to versioned endpoints requires clients to update base URLs.

### Migration Path

1. Existing unversioned endpoints will be aliased to `/api/v1/`
2. 6-month migration period with deprecation headers on unversioned paths
3. Unversioned paths sunset after migration period

---

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|:------------|:-----|:-----|:---------|
| Header versioning (`Accept-Version`) | Cleaner URLs | Harder to test, cache | Rejected: URL versioning more visible |
| Query param (`?version=1`) | Easy to add | Caching issues, less RESTful | Rejected: Path versioning standard |
| Date-based versions | Very granular | Complex client logic | Rejected: Too complex |

---

## Open Questions

- [x] ~~Should we support version ranges?~~ **Resolved: No, single version only**
- [ ] How do we handle versioning for GraphQL endpoints?

---

## Changelog

| Date | Author | Change |
|:-----|:-------|:-------|
| 2025-01-06 | @platform-team | Accepted after review |
| 2025-01-03 | @platform-team | Initial draft |
