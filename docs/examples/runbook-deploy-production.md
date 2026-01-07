---
layout: default
title: "Production Deploy Runbook"
permalink: /examples/runbook-deploy-production/
nav_exclude: true
is_example: true

doc_type: runbook
doc_status: implemented
doc_owner: "@platform-team"
last_updated: 2025-01-04
related:
  - title: "Runbook: Rollback Production"
    url: /secondspring-v3/runbook-rollback-production/
---

# Runbook: Production Deployment
{: .no_toc }

| Field | Value |
|:------|:------|
| **Owner** | @platform-team |
| **Status** | Implemented |
| **Last Updated** | 2025-01-04 |
| **Last Tested** | 2025-01-02 |
| **Escalation** | #platform-oncall or page `platform-primary` |

{: .warning }
> **Before proceeding:** Ensure you have deploy permissions and have verified the release in staging.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

This runbook covers the standard production deployment process for the main application. It includes pre-deploy checks, deployment steps, verification, and rollback procedures.

### When to Use

- Deploying a new release to production
- Deploying hotfixes
- Scheduled maintenance deployments

### When NOT to Use

- Database migrations requiring downtime (see [Runbook: Database Migrations](/secondspring-v3/runbook-db-migrations/))
- Infrastructure changes (see [Runbook: Infrastructure Updates](/secondspring-v3/runbook-infra-updates/))

---

## Prerequisites

### Required Access

- [ ] GitHub repository write access
- [ ] AWS console access (read at minimum)
- [ ] Kubernetes cluster access (`kubectl` configured)
- [ ] Datadog dashboard access

### Required Tools

- `kubectl` v1.28+
- `aws` CLI v2
- `gh` CLI (GitHub CLI)

### Required Knowledge

- Familiarity with Kubernetes deployments
- Understanding of our CI/CD pipeline
- Access to #deploys Slack channel

---

## Pre-Flight Checklist

{: .important }
> Complete all items before starting the deployment.

- [ ] Release has passed all CI checks on `main`
- [ ] Release has been verified in staging environment
- [ ] No ongoing incidents (check [status page](https://status.example.com))
- [ ] Deployment window confirmed (avoid peak hours: 9-11am, 2-4pm ET)
- [ ] Notify #deploys channel: "Starting production deploy of v1.2.3"
- [ ] Have [rollback runbook](/secondspring-v3/runbook-rollback-production/) open in another tab

---

## Procedure

### Step 1: Verify Release Readiness

**Purpose:** Confirm the release is ready and CI has passed.

```bash
# Check the latest release tag
gh release view --repo your-org/your-repo

# Verify CI status on main
gh run list --repo your-org/your-repo --branch main --limit 5
```

**Expected output:**
```
v1.2.3  Latest  2025-01-04
✓ Build and Test  completed  main  2m ago
```

**Verification:**
- [ ] Latest release tag matches expected version
- [ ] CI shows green checkmarks for all workflows

{: .note }
> If CI is red, do not proceed. Investigate failures first.

---

### Step 2: Create Deployment

**Purpose:** Trigger the production deployment pipeline.

```bash
# Trigger deployment workflow
gh workflow run deploy-production.yml \
  --repo your-org/your-repo \
  -f version=v1.2.3 \
  -f environment=production
```

**Expected output:**
```
✓ Created workflow_dispatch event for deploy-production.yml
```

**Verification:**
- [ ] Workflow run appears in GitHub Actions
- [ ] Deployment notification posted to #deploys

---

### Step 3: Monitor Deployment Progress

**Purpose:** Watch the deployment and catch issues early.

```bash
# Watch deployment status
kubectl rollout status deployment/app -n production --timeout=10m
```

**Expected output:**
```
deployment "app" successfully rolled out
```

**Verification:**
- [ ] All pods show `Running` status
- [ ] No pods in `CrashLoopBackOff` or `Error` state
- [ ] Deployment completes within 10 minutes

```bash
# Check pod status
kubectl get pods -n production -l app=main-app
```

{: .warning }
> If pods are failing, proceed to [Rollback](#rollback) immediately.

---

### Step 4: Verify Application Health

**Purpose:** Confirm the application is serving traffic correctly.

```bash
# Check health endpoint
curl -s https://api.example.com/health | jq .
```

**Expected output:**
```json
{
  "status": "healthy",
  "version": "v1.2.3",
  "checks": {
    "database": "ok",
    "cache": "ok"
  }
}
```

**Verification:**
- [ ] Health endpoint returns 200
- [ ] Version matches deployed version
- [ ] All dependency checks pass

---

### Step 5: Verify Key Functionality

**Purpose:** Smoke test critical user paths.

- [ ] Home page loads: `curl -I https://www.example.com`
- [ ] API responds: `curl https://api.example.com/v1/status`
- [ ] Login flow works (manual check)
- [ ] Check Datadog dashboard for error rate

{: .tip }
> Open the [Production Dashboard](https://app.datadoghq.com/dashboard/xxx) to monitor metrics.

---

### Step 6: Complete Deployment

**Purpose:** Finalize and communicate completion.

**Verification:**
- [ ] Update #deploys with completion message
- [ ] Monitor error rates for 15 minutes post-deploy
- [ ] Close deployment tracking ticket (if applicable)

---

## Verification

After completing all steps, verify success:

- [ ] `kubectl get pods -n production` shows all pods running
- [ ] Health endpoint returns correct version
- [ ] Error rate in Datadog is at or below baseline
- [ ] No alerts firing in PagerDuty

**Success criteria:** All pods healthy, correct version deployed, error rate stable for 15 minutes.

---

## Rollback

{: .warning }
> Use this section if the deployment fails or causes issues.

### When to Rollback

- Pods failing to start or crash-looping
- Error rate spikes above 1%
- Health checks failing
- User-reported critical functionality broken

### Rollback Steps

1. **Initiate rollback:**
   ```bash
   kubectl rollout undo deployment/app -n production
   ```

2. **Verify rollback:**
   ```bash
   kubectl rollout status deployment/app -n production
   ```

3. **Confirm previous version:**
   ```bash
   curl -s https://api.example.com/health | jq .version
   ```

4. **Notify team:**
   Post to #deploys: "⚠️ Rolled back v1.2.3 to previous version due to [reason]"

5. **Create incident ticket** if user impact occurred.

---

## Troubleshooting

### Issue: Pods stuck in `Pending`

**Symptoms:** Pods show `Pending` status for more than 2 minutes.

**Cause:** Usually insufficient cluster resources or scheduling constraints.

**Resolution:**
1. Check events: `kubectl describe pod <pod-name> -n production`
2. Look for "Insufficient cpu" or "Insufficient memory"
3. If resource issue, scale up node group or wait for capacity
4. If persistent, escalate to @platform-oncall

---

### Issue: Pods in `CrashLoopBackOff`

**Symptoms:** Pods repeatedly crash and restart.

**Cause:** Application startup failure (config, dependencies, code bug).

**Resolution:**
1. Check logs: `kubectl logs <pod-name> -n production --previous`
2. Look for startup errors or missing config
3. If config issue, fix and redeploy
4. If code bug, rollback immediately

---

### Issue: Health checks failing

**Symptoms:** Health endpoint returns non-200 or incorrect data.

**Cause:** Application partially running or dependency failure.

**Resolution:**
1. Check which health check is failing
2. Verify dependent services (database, cache)
3. Check application logs for connection errors
4. If dependency is down, that's a separate incident

---

## Escalation

If you cannot resolve an issue:

1. **Slack:** Post in #platform-oncall with deployment link and symptoms
2. **PagerDuty:** Page `platform-primary` if production is degraded
3. **Rollback first:** When in doubt, rollback and investigate after

---

## Changelog

| Date | Author | Change |
|:-----|:-------|:-------|
| 2025-01-04 | @platform-team | Added troubleshooting for CrashLoopBackOff |
| 2025-01-02 | @platform-team | Tested full procedure |
| 2024-12-15 | @platform-team | Initial version |
