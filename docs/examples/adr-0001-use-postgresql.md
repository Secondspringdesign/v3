---
layout: default
title: "ADR-0001: Use PostgreSQL"
permalink: /examples/adr-0001-use-postgresql/
nav_exclude: true
is_example: true

doc_type: adr
doc_status: accepted
doc_owner: "@platform-team"
last_updated: 2025-01-03
related: []
---

# ADR-0001: Use PostgreSQL for Primary Datastore
{: .no_toc }

| Field | Value |
|:------|:------|
| **Owner** | @platform-team |
| **Status** | Accepted |
| **Date** | 2025-01-03 |
| **Supersedes** | None |
| **Superseded by** | None |

---

## Context

We are building a new application and need to select a primary database. The application requires:

- Relational data with complex queries (joins, aggregations)
- ACID transactions for financial operations
- Full-text search for user-facing features
- JSON storage for flexible metadata
- Strong ecosystem and operational tooling

The team has experience with PostgreSQL and MySQL. We've evaluated MongoDB for its flexibility but have concerns about transaction support for our use case.

---

## Decision

We will use **PostgreSQL 16** as our primary relational datastore.

{: .important }
> PostgreSQL will be the default choice for all new services unless a specific use case justifies an alternative (documented via ADR).

---

## Rationale

We chose PostgreSQL because:

1. **Feature completeness**: Native JSON support, full-text search, and advanced indexing reduce need for additional systems.
2. **Transaction support**: Strong ACID guarantees for our financial operations.
3. **Team expertise**: Multiple team members have production PostgreSQL experience.
4. **Ecosystem**: Excellent tooling (pgAdmin, pg_dump, logical replication) and cloud support (RDS, Cloud SQL, Aurora).
5. **Performance**: Proven performance at our expected scale with proper indexing.

---

## Alternatives Considered

### Alternative 1: MySQL 8

- **Pros**: Familiar to some team members; wide hosting support; good performance
- **Cons**: Weaker JSON support; less advanced indexing; GIS features require extensions
- **Why rejected**: PostgreSQL's JSON and full-text search features better match our requirements

### Alternative 2: MongoDB

- **Pros**: Flexible schema; good for document-oriented data; horizontal scaling
- **Cons**: Multi-document transactions added recently; different query paradigm; team inexperience
- **Why rejected**: Our data is relational; transactions are critical; team lacks MongoDB experience

### Alternative 3: CockroachDB

- **Pros**: PostgreSQL-compatible; distributed by default; strong consistency
- **Cons**: Higher operational complexity; cost; overkill for initial scale
- **Why rejected**: Premature optimization; can migrate later if needed

---

## Consequences

### Positive

- Single database technology reduces operational overhead
- Native JSON eliminates need for separate document store
- Full-text search reduces need for Elasticsearch initially
- Strong backup and replication options

### Negative

- Vertical scaling limits (acceptable for projected 3-year growth)
- Team members unfamiliar with PostgreSQL-specific features need training
- Some NoSQL patterns require adaptation

### Neutral

- Need to establish connection pooling strategy (pgBouncer vs application-level)
- Will use managed service (RDS) to reduce operational burden

---

## Implementation Notes

- Use RDS PostgreSQL 16 in production
- Enable logical replication for future read replicas
- Establish naming conventions for schemas and tables
- Document connection pooling configuration

---

## References

- [PostgreSQL 16 Release Notes](https://www.postgresql.org/docs/16/release-16.html)
- [PostgreSQL vs MySQL Comparison](https://www.postgresql.org/about/)
- Internal Slack discussion: #platform-database-decision
