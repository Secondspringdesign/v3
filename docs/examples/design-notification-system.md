---
layout: default
title: "Notification System Design"
permalink: /examples/design-notification-system/
nav_exclude: true
is_example: true

doc_type: design
doc_status: proposed
doc_owner: "@backend-team"
last_updated: 2025-01-05
related:
  - title: "ADR-0003: Event-Driven Architecture"
    url: /secondspring-v3/adr-0003-event-driven/
---

# Notification System Design
{: .no_toc }

| Field | Value |
|:------|:------|
| **Owner** | @backend-team |
| **Status** | Proposed |
| **Last Updated** | 2025-01-05 |
| **Related** | [ADR-0003: Event-Driven](/secondspring-v3/adr-0003-event-driven/) |

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

Design a unified notification system to deliver messages across email, push, SMS, and in-app channels. The system will support templating, delivery preferences, rate limiting, and delivery tracking.

---

## Motivation

### Problem Statement

Currently, notifications are sent from multiple services with inconsistent formatting, no central preference management, and limited delivery tracking. Users report notification fatigue and inability to control what they receive.

### User Stories

- As a user, I want to choose which notifications I receive and through which channels.
- As a user, I want consistent formatting across all notification types.
- As an admin, I want to track notification delivery rates and engagement.
- As a developer, I want a simple API to send notifications without managing channel logic.

---

## Goals and Non-Goals

### Goals

- Unified API for all notification channels
- User preference management with granular controls
- Template system for consistent messaging
- Delivery tracking and analytics
- Rate limiting to prevent notification spam

### Non-Goals

- Marketing campaign management (separate system)
- Real-time chat functionality
- Social media integrations

---

## Proposed Design

### Architecture Overview

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Services   │────▶│ Notification API │────▶│    Queue    │
└──────────────┘     └──────────────────┘     └─────────────┘
                              │                      │
                              ▼                      ▼
                     ┌────────────────┐     ┌───────────────┐
                     │  Preferences   │     │   Workers     │
                     │    Service     │     │ (per channel) │
                     └────────────────┘     └───────────────┘
                                                    │
                            ┌───────────────────────┼───────────────────────┐
                            ▼                       ▼                       ▼
                     ┌───────────┐          ┌───────────┐          ┌───────────┐
                     │   Email   │          │   Push    │          │    SMS    │
                     │ (SendGrid)│          │(FCM/APNs) │          │ (Twilio)  │
                     └───────────┘          └───────────┘          └───────────┘
```

### Components

#### Notification API

REST API for submitting notifications. Validates requests, applies templates, checks preferences, and enqueues for delivery.

#### Preferences Service

Manages user notification preferences per category and channel. Provides APIs for users to update settings and for workers to check deliverability.

#### Queue (RabbitMQ)

Durable message queue with per-channel queues and dead-letter handling for failed deliveries.

#### Channel Workers

Dedicated workers per channel (email, push, SMS, in-app) that consume from queues and interface with external providers.

### Data Flow

1. Service calls `POST /notifications` with recipient, type, and data
2. API validates request and fetches user preferences
3. API applies template and determines eligible channels
4. Message enqueued to relevant channel queues
5. Workers deliver and record status
6. Webhooks update delivery status (opens, clicks)

### API Design

| Endpoint | Method | Description |
|:---------|:-------|:------------|
| `/notifications` | POST | Send notification |
| `/notifications/{id}` | GET | Get delivery status |
| `/preferences/{user_id}` | GET | Get user preferences |
| `/preferences/{user_id}` | PATCH | Update preferences |
| `/templates` | GET | List templates |

**Send Notification Request:**
```json
{
  "user_id": "usr_123",
  "type": "order_shipped",
  "data": {
    "order_id": "ord_456",
    "tracking_url": "https://..."
  },
  "channels": ["email", "push"]
}
```

### Error Handling

| Error | Handling | User Message |
|:------|:---------|:-------------|
| Invalid user | 404, no retry | N/A (internal) |
| Provider timeout | Retry with backoff | Delayed delivery |
| Rate limited | Queue with delay | N/A (transparent) |
| Template missing | 500, alert oncall | N/A (internal) |

---

## Alternatives Considered

### Alternative 1: Per-Service Notification Logic

**Description:** Each service continues managing its own notifications.

- **Pros**: No new system to build; services have full control
- **Cons**: Inconsistent UX; duplicated code; no central preferences
- **Why not chosen**: Doesn't solve user experience problems

### Alternative 2: Third-Party Notification Platform

**Description:** Use SaaS platform (Customer.io, etc.) for all notification orchestration.

- **Pros**: Faster to implement; rich features
- **Cons**: Vendor lock-in; cost at scale; less customization
- **Why not chosen**: Cost prohibitive at our scale; need custom integrations

---

## Technical Considerations

### Performance

- Expected load: 100K notifications/day initially, 1M/day at scale
- Latency target: < 500ms queue time, delivery SLA per channel
- Scaling: Horizontal worker scaling per channel

### Security

- API authentication via service tokens
- User preferences require authenticated user context
- PII encrypted at rest; tokens for external providers in secrets manager

### Reliability

- Queue persistence with acknowledgment
- DLQ for failed messages with alerting
- Provider failover (e.g., backup email provider)
- SLO: 99.9% delivery within channel SLAs

### Testing Strategy

- Unit tests: Template rendering, preference logic
- Integration tests: Queue flow, provider mocks
- Load tests: 10x expected traffic

---

## Implementation Plan

### Phase 1: Core Infrastructure

- [ ] Set up Notification API service
- [ ] Implement message queue infrastructure
- [ ] Create basic email worker with SendGrid

### Phase 2: Preferences & Templates

- [ ] Build Preferences Service
- [ ] Implement template system
- [ ] Add user preference UI

### Phase 3: Additional Channels

- [ ] Push notification worker (FCM/APNs)
- [ ] SMS worker (Twilio)
- [ ] In-app notification channel

### Dependencies

| Dependency | Owner | Status |
|:-----------|:------|:-------|
| RabbitMQ cluster | @infra | Available |
| SendGrid account | @platform | Configured |
| FCM setup | @mobile | In progress |

---

## Rollout Plan

### Feature Flags

| Flag | Purpose | Default |
|:-----|:--------|:--------|
| `notifications_v2_enabled` | Route to new system | false |
| `notifications_v2_percentage` | Rollout percentage | 0 |

### Rollout Stages

1. **Internal**: Dogfood with internal users
2. **Canary**: 5% of notifications
3. **Limited**: 25% → 50% → 75%
4. **General**: 100%

### Rollback Plan

1. Set `notifications_v2_enabled` to false
2. Traffic routes to legacy system
3. Queue drains; no messages lost

---

## Open Questions

- [ ] Should we support notification batching/digests in v1?
- [ ] What's the retention policy for delivery history?

---

## Changelog

| Date | Author | Change |
|:-----|:-------|:-------|
| 2025-01-05 | @backend-team | Initial proposal |
