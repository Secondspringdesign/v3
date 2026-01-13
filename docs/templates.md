---
layout: default
title: Templates
nav_order: 3
permalink: /templates/
---

# Doc Templates
{: .no_toc }

Start from a template to ensure consistent structure and metadata.
{: .fs-6 .fw-300 }

---

## Available Templates

| Template | Use For |
|:---------|:--------|
| [Spec Template](/secondspring-v3/templates/spec-template/) | APIs, protocols, PRDs, contracts |
| [Design Doc Template](/secondspring-v3/templates/design-doc-template/) | System architecture, feature design |
| [ADR Template](/secondspring-v3/templates/adr-template/) | Architecture decisions |
| [Runbook Template](/secondspring-v3/templates/runbook-template/) | Operational procedures |
| [Report Template](/secondspring-v3/templates/report-template/) | Status updates, postmortems, code reviews |

---

## How to Use Templates

1. **Click the template link** above to view it
2. **Copy the raw Markdown** (click "Edit this page on GitHub" → copy content)
3. **Create a new file** in `docs/` with the appropriate name:
   - `spec-<topic>.md`
   - `design-<feature>.md`
   - `adr-NNNN-<decision>.md`
   - `runbook-<procedure>.md`
   - `report-<subject>.md`
4. **Update the front matter** with your doc's metadata
5. **Fill in the sections** and delete any that don't apply
6. **Submit a PR** for review

{: .important }
> Always update the `permalink` in front matter to match your filename slug. This ensures stable URLs even if you reorganize files later.

---

## Template Front Matter Reference

Every doc should include this front matter:

```yaml
---
layout: default
title: "Your Doc Title"
permalink: /<your-slug>/
nav_exclude: true

# Metadata (rendered in doc header)
doc_type: spec | design | adr | runbook | report
doc_status: draft | proposed | accepted | implemented | deprecated
doc_owner: "@username or Team Name"
last_updated: YYYY-MM-DD
related:
  - title: "Related Doc"
    url: /secondspring-v3/related-slug/
---
```

See [Contributing Guide](/secondspring-v3/contributing/) for full details on metadata fields.
