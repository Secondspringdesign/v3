---
layout: default
title: Contributing
nav_order: 4
permalink: /contributing/
---

# Contributing Guide
{: .no_toc }

How to create, maintain, and review documentation.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Doc Lifecycle

Every document progresses through these stages:

| Status | Meaning | Actions |
|:-------|:--------|:--------|
| **Draft** | Work in progress | Author editing, not ready for review |
| **Proposed** | Ready for review | Team reviews, provides feedback |
| **Accepted** | Approved | Ready for implementation |
| **Implemented** | In production | Code/process matches doc |
| **Deprecated** | Retired | Kept for history, marked clearly |

{: .note }
> Update `doc_status` in front matter when the status changes. Add a note in the doc's changelog section.

---

## Naming Conventions

Use lowercase, hyphen-separated names:

| Doc Type | Pattern | Example |
|:---------|:--------|:--------|
| Spec | `spec-<topic>.md` | `spec-authentication-flow.md` |
| Design Doc | `design-<feature>.md` | `design-notification-system.md` |
| ADR | `adr-NNNN-<decision>.md` | `adr-0001-use-postgresql.md` |
| Runbook | `runbook-<procedure>.md` | `runbook-deploy-production.md` |
| Report | `report-<subject>.md` | `report-q4-reliability.md` |

{: .warning }
> Never rename a file after it's published. If you must reorganize, keep the original `permalink` to avoid breaking links.

---

## How to Add a New Page

### Step 1: Choose a Template

Browse [Templates](/secondspring-v3/templates/) and pick the right one for your doc type.

### Step 2: Create the File

```bash
# From repo root
cp docs/templates/<template>.md docs/<your-doc-name>.md
```

### Step 3: Update Front Matter

```yaml
---
layout: default
title: "Your Descriptive Title"
permalink: /<your-doc-slug>/
nav_exclude: true

doc_type: spec
doc_status: draft
doc_owner: "@yourusername"
last_updated: 2025-01-06
related:
  - title: "Related Spec"
    url: /secondspring-v3/related-spec/
---
```

### Step 4: Write Content

Fill in the template sections. Delete sections that don't apply—don't leave empty headings.

### Step 5: Submit PR

```bash
git checkout -b docs/your-doc-name
git add docs/
git commit -m "docs: add your-doc-name"
git push origin docs/your-doc-name
```

---

## Front Matter Reference

### Required Fields

| Field | Description |
|:------|:------------|
| `layout` | Always `default` |
| `title` | Human-readable title |
| `permalink` | Stable URL path (e.g., `/spec-auth/`) |
| `nav_exclude` | Set `true` for docs (keeps nav clean) |

### Metadata Fields

| Field | Values | Description |
|:------|:-------|:------------|
| `doc_type` | `spec`, `design`, `plan`, `adr`, `runbook`, `report` | Document category (auto-indexed) |
| `doc_status` | `draft`, `proposed`, `accepted`, `ready`, `final`, `implemented`, `deprecated` | Current lifecycle stage |
| `doc_owner` | `@username` or team name | Primary maintainer |
| `last_updated` | `YYYY-MM-DD` | Last significant edit |
| `related` | List of `{title, url}` | Related documents |

---

## Metadata Header Pattern

Every doc should start with a metadata header after the title:

| Field | Value |
|:------|:------|
| **Owner** | @username |
| **Status** | Draft / Proposed / Accepted / Implemented / Deprecated |
| **Last Updated** | 2025-01-06 |
| **Related** | [Related Doc](/secondspring-v3/related/) |

This provides at-a-glance context for readers.

---

## Auto-Generated Index

{: .tip }
> The [Docs Index](/secondspring-v3/docs/) is **auto-generated** from front matter. No manual editing required!

When you add a doc with proper `doc_type` and `doc_status` front matter, it automatically appears in:
1. The appropriate **category table** (Specs, Design Docs, Plans, ADRs, Runbooks, Reports)
2. The **All Docs by Status** section

**Required front matter for auto-indexing:**
- `doc_type` — determines which category table
- `doc_status` — determines status grouping
- `doc_owner` — shown in tables
- `last_updated` — shown in tables, used for sorting (newest first)

To help search find your doc, use keywords in the title or first paragraph.

---

## Review Checklist

Before marking a doc as "Proposed":

- [ ] Front matter is complete (`doc_type`, `doc_status`, `doc_owner`, `last_updated`)
- [ ] All template sections are filled or removed
- [ ] Links to related docs work
- [ ] Code examples are tested
- [ ] Diagrams have alt text
- [ ] Spelling and grammar checked

---

## Getting Help

- **Questions:** Open an issue with `docs` label
- **Template issues:** File an issue with `docs-template` label
- **Site bugs:** File an issue with `docs-site` label
