---
layout: default
title: "Runbook Template"
permalink: /templates/runbook-template/
nav_exclude: true
is_template: true

doc_type: runbook
doc_status: draft
doc_owner: "@author"
last_updated: YYYY-MM-DD
related: []
---

# Runbook: [Procedure Name]
{: .no_toc }

<!-- Delete this instruction block before publishing -->
<!--
USAGE: Copy to docs/runbook-<procedure>.md
Runbooks should be tested regularly and updated after incidents.
-->

| Field | Value |
|:------|:------|
| **Owner** | @author |
| **Status** | Draft |
| **Last Updated** | YYYY-MM-DD |
| **Last Tested** | YYYY-MM-DD |
| **Escalation** | #channel or @team |

{: .warning }
> **Before proceeding:** Ensure you have the required permissions and have notified relevant stakeholders.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

<!-- One paragraph: what this runbook covers -->

Brief description of what procedure this runbook documents.

### When to Use

- Scenario 1 when this runbook applies
- Scenario 2 when this runbook applies

### When NOT to Use

- Scenario when a different procedure applies

---

## Prerequisites

### Required Access

- [ ] Access to system X
- [ ] Permission Y
- [ ] VPN connected

### Required Tools

- Tool 1 (version X+)
- Tool 2

### Required Knowledge

- Familiarity with system X
- Understanding of process Y

---

## Pre-Flight Checklist

{: .important }
> Complete all items before starting the procedure.

- [ ] Notify team in #channel
- [ ] Verify current system status
- [ ] Confirm maintenance window (if applicable)
- [ ] Have rollback plan ready

---

## Procedure

### Step 1: [Action Name]

**Purpose:** Why this step is needed.

```bash
# Command to execute
command --flag value
```

**Expected output:**
```
Output you should see
```

**Verification:**
- [ ] Check that X shows Y
- [ ] Confirm Z in dashboard

{: .note }
> If you see [error], try [resolution].

---

### Step 2: [Action Name]

**Purpose:** Why this step is needed.

```bash
# Command to execute
command --flag value
```

**Expected output:**
```
Output you should see
```

**Verification:**
- [ ] Verification step

---

### Step 3: [Action Name]

<!-- Continue pattern -->

---

## Verification

After completing all steps, verify success:

- [ ] Check 1: Description
- [ ] Check 2: Description
- [ ] Check 3: Description

**Success criteria:** How to know the procedure succeeded.

---

## Rollback

{: .warning }
> Use this section if the procedure fails or causes issues.

### When to Rollback

- Symptom 1
- Symptom 2

### Rollback Steps

1. Step 1
2. Step 2
3. Step 3

---

## Troubleshooting

### Issue: [Problem Description]

**Symptoms:** What you observe.

**Cause:** Why this happens.

**Resolution:**
1. Step to fix
2. Step to fix

---

### Issue: [Problem Description]

<!-- Same structure -->

---

## Escalation

If you cannot resolve an issue:

1. **Slack:** Post in #channel with details
2. **PagerDuty:** Page @team if production impact
3. **Manager:** Contact @manager for decisions

---

## Changelog

| Date | Author | Change |
|:-----|:-------|:-------|
| YYYY-MM-DD | @author | Initial version |

---

## How to Review

{: .tip }
> **For Reviewers:**

- [ ] Are steps clear and actionable?
- [ ] Are commands correct and tested?
- [ ] Is verification sufficient?
- [ ] Is rollback procedure complete?
- [ ] Are common issues documented?
