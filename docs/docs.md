---
layout: default
title: Docs Index
nav_order: 2
permalink: /docs/
---

# Docs Index
{: .no_toc }

All documentation organized by category. Each doc lives directly in `docs/` for simplicity.
{: .fs-6 .fw-300 }

{: .tip }
> **Auto-generated**: This index automatically lists all docs based on their `doc_type` front matter. Just add a doc with proper front matter and it appears here.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Specs

Technical specifications and product requirements defining APIs, protocols, and system contracts.

{% assign specs_unsorted = site.pages | where: "doc_type", "spec" | where_exp: "p", "p.is_template != true" | where_exp: "p", "p.is_example != true" %}
{% assign specs = specs_unsorted | sort_natural: "last_updated" | reverse %}
{% if specs.size > 0 %}
| Document | Status | Owner | Updated |
|:---------|:-------|:------|:--------|
{% for doc in specs %}| [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }}) | {{ doc.doc_status | capitalize }} | {{ doc.doc_owner }} | {{ doc.last_updated }} |
{% endfor %}
{% else %}
*No specs yet.*
{% endif %}

[Spec Template]({{ site.baseurl }}/templates/spec-template/){: .btn .btn-outline .fs-3 }
[Spec Example]({{ site.baseurl }}/examples/spec-api-versioning/){: .btn .btn-outline .fs-3 }

---

## Design Docs

Architectural proposals and system design documents.

{% assign designs_unsorted = site.pages | where: "doc_type", "design" | where_exp: "p", "p.is_template != true" | where_exp: "p", "p.is_example != true" %}
{% assign designs = designs_unsorted | sort_natural: "last_updated" | reverse %}
{% if designs.size > 0 %}
| Document | Status | Owner | Updated |
|:---------|:-------|:------|:--------|
{% for doc in designs %}| [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }}) | {{ doc.doc_status | capitalize }} | {{ doc.doc_owner }} | {{ doc.last_updated }} |
{% endfor %}
{% else %}
*No design docs yet.*
{% endif %}

[Design Doc Template]({{ site.baseurl }}/templates/design-doc-template/){: .btn .btn-outline .fs-3 }
[Design Doc Example]({{ site.baseurl }}/examples/design-notification-system/){: .btn .btn-outline .fs-3 }

---

## Plans

Implementation plans with tracked tasks and dependencies.

{% assign plans_unsorted = site.pages | where: "doc_type", "plan" | where_exp: "p", "p.is_template != true" | where_exp: "p", "p.is_example != true" %}
{% assign plans = plans_unsorted | sort_natural: "last_updated" | reverse %}
{% if plans.size > 0 %}
| Document | Status | Owner | Updated |
|:---------|:-------|:------|:--------|
{% for doc in plans %}| [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }}) | {{ doc.doc_status | capitalize }} | {{ doc.doc_owner }} | {{ doc.last_updated }} |
{% endfor %}
{% else %}
*No plans yet.*
{% endif %}

---

## ADRs (Architecture Decision Records)

Lightweight records of significant architectural decisions.

{% assign adrs_unsorted = site.pages | where: "doc_type", "adr" | where_exp: "p", "p.is_template != true" | where_exp: "p", "p.is_example != true" %}
{% assign adrs = adrs_unsorted | sort_natural: "last_updated" | reverse %}
{% if adrs.size > 0 %}
| ID | Decision | Status | Date |
|:---|:---------|:-------|:-----|
{% for doc in adrs %}| [{{ doc.title | split: ": " | first }}]({{ site.baseurl }}{{ doc.url }}) | {{ doc.title | split: ": " | last }} | {{ doc.doc_status | capitalize }} | {{ doc.last_updated }} |
{% endfor %}
{% else %}
*No ADRs yet.*
{% endif %}

[ADR Template]({{ site.baseurl }}/templates/adr-template/){: .btn .btn-outline .fs-3 }
[ADR Example]({{ site.baseurl }}/examples/adr-0001-use-postgresql/){: .btn .btn-outline .fs-3 }

{: .note }
> ADRs are numbered sequentially. Check existing ADRs before creating a new one to get the next number.

---

## Runbooks

Step-by-step operational procedures for common tasks and incidents.

{% assign runbooks_unsorted = site.pages | where: "doc_type", "runbook" | where_exp: "p", "p.is_template != true" | where_exp: "p", "p.is_example != true" %}
{% assign runbooks = runbooks_unsorted | sort_natural: "last_updated" | reverse %}
{% if runbooks.size > 0 %}
| Runbook | Status | Owner | Updated |
|:--------|:-------|:------|:--------|
{% for doc in runbooks %}| [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }}) | {{ doc.doc_status | capitalize }} | {{ doc.doc_owner }} | {{ doc.last_updated }} |
{% endfor %}
{% else %}
*No runbooks yet.*
{% endif %}

[Runbook Template]({{ site.baseurl }}/templates/runbook-template/){: .btn .btn-outline .fs-3 }
[Runbook Example]({{ site.baseurl }}/examples/runbook-deploy-production/){: .btn .btn-outline .fs-3 }

---

## Reports

Status updates, postmortems, code reviews, and periodic reviews.

{% assign reports_unsorted = site.pages | where: "doc_type", "report" | where_exp: "p", "p.is_template != true" | where_exp: "p", "p.is_example != true" %}
{% assign reports = reports_unsorted | sort_natural: "last_updated" | reverse %}
{% if reports.size > 0 %}
| Report | Status | Owner | Updated |
|:-------|:-------|:------|:--------|
{% for doc in reports %}| [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }}) | {{ doc.doc_status | capitalize }} | {{ doc.doc_owner }} | {{ doc.last_updated }} |
{% endfor %}
{% else %}
*No reports yet.*
{% endif %}

[Report Template]({{ site.baseurl }}/templates/report-template/){: .btn .btn-outline .fs-3 }
[Report Example]({{ site.baseurl }}/examples/report-q4-system-reliability/){: .btn .btn-outline .fs-3 }

---

## All Docs by Status

{: .tip }
> Use the search bar above to find docs by keyword.

{% assign all_docs_unsorted = site.pages | where_exp: "page", "page.doc_type != nil" | where_exp: "p", "p.is_template != true" | where_exp: "p", "p.is_example != true" %}
{% assign all_docs = all_docs_unsorted | sort_natural: "last_updated" | reverse %}

### Draft
Documents in progress, not ready for review.

{% assign drafts = all_docs | where: "doc_status", "draft" %}
{% if drafts.size > 0 %}
{% for doc in drafts %}- [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }})
{% endfor %}
{% else %}
*None*
{% endif %}

### Proposed
Ready for team review and feedback.

{% assign proposed = all_docs | where: "doc_status", "proposed" %}
{% if proposed.size > 0 %}
{% for doc in proposed %}- [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }})
{% endfor %}
{% else %}
*None*
{% endif %}

### Approved / Accepted
Approved and ready for implementation.

{% assign approved = all_docs | where: "doc_status", "approved" %}
{% assign accepted = all_docs | where: "doc_status", "accepted" %}
{% assign ready = all_docs | where: "doc_status", "ready" %}
{% assign approved_all = approved | concat: accepted | concat: ready %}
{% if approved_all.size > 0 %}
{% for doc in approved_all %}- [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }})
{% endfor %}
{% else %}
*None*
{% endif %}

### Final / Implemented
Fully implemented and in production.

{% assign final = all_docs | where: "doc_status", "final" %}
{% assign implemented = all_docs | where: "doc_status", "implemented" %}
{% assign final_all = final | concat: implemented %}
{% if final_all.size > 0 %}
{% for doc in final_all %}- [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }})
{% endfor %}
{% else %}
*None*
{% endif %}

### Deprecated
No longer active; kept for historical reference.

{% assign deprecated = all_docs | where: "doc_status", "deprecated" %}
{% if deprecated.size > 0 %}
{% for doc in deprecated %}- [{{ doc.title }}]({{ site.baseurl }}{{ doc.url }})
{% endfor %}
{% else %}
*None*
{% endif %}
