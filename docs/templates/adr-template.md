---
layout: default
title: "ADR Template"
permalink: /templates/adr-template/
nav_exclude: true
is_template: true

doc_type: adr
doc_status: draft
doc_owner: "@author"
last_updated: YYYY-MM-DD
related: []
---

# ADR-NNNN: [Decision Title]
{: .no_toc }

<!-- Delete this instruction block before publishing -->
<!--
USAGE: Copy to docs/adr-NNNN-<decision>.md
Replace NNNN with the next sequential number.
ADRs are immutable once accepted—add superseding ADRs instead of editing.
-->

| Field | Value |
|:------|:------|
| **Owner** | @author |
| **Status** | Proposed |
| **Date** | YYYY-MM-DD |
| **Supersedes** | [ADR-XXXX](/v3/adr-xxxx/) (if applicable) |
| **Superseded by** | None |

---

## Context

<!-- What is the issue we're seeing that motivates this decision? -->

Describe the context and problem that requires a decision. Include:
- Current state
- Forces at play (technical, business, team constraints)
- Why a decision is needed now

---

## Decision

<!-- What is the change we're proposing and/or doing? -->

We will [decision].

{: .important }
> State the decision clearly and unambiguously.

---

## Rationale

<!-- Why did we choose this option over others? -->

We chose this approach because:

1. **Reason 1**: Explanation
2. **Reason 2**: Explanation
3. **Reason 3**: Explanation

---

## Alternatives Considered

### Alternative 1: [Name]

Description of the alternative.

- **Pros**: Benefits
- **Cons**: Drawbacks
- **Why rejected**: Reason

### Alternative 2: [Name]

Description of the alternative.

- **Pros**: Benefits
- **Cons**: Drawbacks
- **Why rejected**: Reason

---

## Consequences

### Positive

- Benefit 1
- Benefit 2

### Negative

- Drawback 1 (and mitigation if any)
- Drawback 2

### Neutral

- Side effect that is neither positive nor negative

---

## Implementation Notes

<!-- Optional: guidance for implementing this decision -->

- Key consideration 1
- Key consideration 2

---

## References

- [Link to relevant doc](/v3/path/)
- [External reference](https://example.com)

---

## How to Review

{: .tip }
> **For Reviewers:**

- [ ] Is the context clear and complete?
- [ ] Is the decision unambiguous?
- [ ] Are alternatives fairly evaluated?
- [ ] Are consequences realistic?
- [ ] Should any other teams be consulted?
