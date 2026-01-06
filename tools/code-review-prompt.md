# Comprehensive Code Review Prompt for Next.js + OpenAI ChatKit Codebases

## Overview

This document contains a reusable code review prompt designed for Next.js 15 applications with OpenAI ChatKit integration. Execute this prompt regularly to identify tech debt, architectural issues, and improvement opportunities.

---

## THE PROMPT

Copy everything below this line and execute it in Claude Code:

---

```
Perform a comprehensive code review of this codebase. This is a Next.js 15 application with React 19, TypeScript, Tailwind CSS 4, and OpenAI ChatKit. Your goal is to identify issues, tech debt, and improvement opportunities, then create actionable Beads tickets.

## PHASE 1: DISCOVERY (Use Explore agents in parallel)

Launch 3 Explore agents simultaneously to gather information:

**Agent 1 - Dependency & Config Audit:**
- Read package.json - note all dependencies and versions
- Check for outdated packages (major versions behind)
- Read tsconfig.json - verify strict mode settings
- Read next.config.ts - check Next.js configuration
- Read eslint.config.mjs - verify linting rules
- Look for .env files and verify no secrets in code
- Check vercel.json for deployment configuration
- Review postcss.config.mjs and Tailwind setup

**Agent 2 - Architecture & Structure Analysis:**
- Map the directory structure and file organization
- Count lines in each file - identify files >300 lines
- Trace the data flow: pages → components → hooks → API routes
- Check for circular dependencies in imports
- Identify the state management pattern
- Look for component reuse vs duplication
- Check App Router patterns (layouts, loading, error boundaries)
- Review API route organization in app/api/

**Agent 3 - Code Quality Scan:**
- Search for TODO, FIXME, HACK, XXX comments
- Find all `: any` and `as any` type usage
- Locate console.log/console.error statements
- Find empty catch blocks or swallowed errors
- Identify magic numbers and hardcoded strings
- Find functions >100 lines
- Look for duplicate code patterns
- Check error handling consistency

## PHASE 2: NEXT.JS APP ROUTER REVIEW

Examine the app/ directory:

**Route Structure:**
- Review page.tsx files for proper server/client boundaries
- Check layout.tsx hierarchy and metadata configuration
- Verify loading.tsx and error.tsx boundaries exist where needed
- Look for proper use of 'use client' directives
- Check for unnecessary client components (should be server by default)

**API Routes:**
- Review each route in app/api/
- Check request validation and error handling
- Verify proper HTTP status codes are returned
- Look for hardcoded secrets (should use env vars)
- Check CORS handling if needed
- Verify rate limiting considerations

**Data Fetching:**
- Check for proper use of Server Components for data fetching
- Look for unnecessary client-side fetching
- Verify caching strategies (revalidate, cache tags)
- Check for N+1 query patterns

## PHASE 3: OPENAI CHATKIT PATTERNS

Check for ChatKit-specific issues:

**Integration:**
- Review ChatKit component usage and configuration
- Check session management (create-session, set-token routes)
- Verify error handling for API failures
- Look for proper loading states during chat operations

**Security:**
- Ensure API keys are not exposed to client
- Check token handling and session security
- Verify user authentication flow if applicable

**UX Patterns:**
- Check for proper error messages to users
- Verify loading/streaming states
- Look for accessibility considerations

## PHASE 4: REACT 19 & TYPESCRIPT PATTERNS

Check for common issues:

**React 19 Features:**
- Check for proper use of new features (use, Actions, etc.)
- Look for deprecated patterns being used
- Verify Server Actions usage if applicable

**TypeScript:**
- Is strict mode enabled? (should be true)
- Find @ts-ignore or @ts-expect-error suppressions
- Check for proper typing of API responses
- Verify component prop types are complete
- Look for implicit any types

**Component Quality:**
- useEffect cleanup functions - are subscriptions cleaned up?
- Are event listeners properly removed?
- Check for unnecessary re-renders (missing useMemo/useCallback)
- Look for inline function definitions in render

## PHASE 5: STYLING & UI REVIEW

**Tailwind CSS 4:**
- Check for consistent design system usage
- Look for hardcoded colors/spacing vs design tokens
- Verify responsive design patterns
- Check for unused or duplicate utility classes
- Review dark mode support if applicable

**Accessibility:**
- Check for proper ARIA attributes
- Verify keyboard navigation
- Look for missing alt text on images
- Check color contrast considerations

## PHASE 6: TESTING & RELIABILITY

**Test Coverage:**
- Is there a test framework configured?
- What percentage of code has tests?
- Are critical paths tested (auth, chat, core features)?
- Are API routes tested?

**Error Handling:**
- Are errors logged/tracked?
- Do users see helpful error messages?
- Is there error boundary implementation?
- Check for global error handling

## PHASE 7: SIMPLIFICATION ANALYSIS

Look for opportunities to simplify:

**Over-Engineering:**
- Abstractions used only once
- Complex patterns where simple ones suffice
- Premature optimization

**Redundant Systems:**
- Multiple ways to do the same thing
- Unused code/dead code
- Duplicate utility functions

**Consolidation Opportunities:**
- Similar components that could be merged
- Repeated patterns that could be extracted
- Configuration that could be centralized

## PHASE 8: COMMON TECH STACK ISSUES

Check for known patterns/anti-patterns:

**Next.js 15:**
- [ ] App Router best practices followed
- [ ] Server vs Client components properly separated
- [ ] Metadata and SEO configured
- [ ] Image optimization using next/image
- [ ] Font optimization using next/font

**React 19:**
- [ ] No deprecated lifecycle methods
- [ ] Proper Suspense boundaries
- [ ] Concurrent features used correctly

**TypeScript:**
- [ ] Strict mode enabled
- [ ] No suppressions (@ts-ignore, @ts-expect-error)
- [ ] Proper type exports for shared types

**Vercel Deployment:**
- [ ] vercel.json properly configured
- [ ] Environment variables documented
- [ ] Edge functions used appropriately

---

## OUTPUT REQUIREMENTS

After completing the analysis, produce these deliverables:

### 1. SUMMARY FOR USER

Create a markdown file in `docs/` with the naming convention `code-review-YYYY-MM-DD.md` (e.g., `docs/code-review-2026-01-06.md`).

The file should contain:

## Code Review Summary - [Date]

### Critical Issues (Fix Immediately)
- [List security issues, data loss risks, broken functionality]

### High Priority (Fix Soon)
- [List significant tech debt, performance issues, maintainability concerns]

### Medium Priority (Plan to Address)
- [List code quality issues, missing tests, documentation gaps]

### Low Priority (Nice to Have)
- [List minor improvements, style inconsistencies, optimization opportunities]

### Strengths
- [Note what the codebase does well]

### Metrics
- Total files analyzed: X
- Files >300 lines: X (list them)
- TODO/FIXME count: X
- `any` type usage: X occurrences
- Test coverage: X% (or "No tests configured")

### 2. CREATE BEADS EPIC

Create an epic using:
```bash
bd create --title="Code Review: [Date]" --type=epic --priority=2
```

**Note the epic ID returned** (e.g., `ss-abc`) - you'll use it as the parent for all tickets.

Include in the description:
- Date of review
- Brief summary (2-3 sentences)
- Count of issues found by priority

### 3. CREATE TICKETS UNDER EPIC

For each issue found, create a ticket with `--parent` pointing to the epic:
```bash
bd create --title="[Brief issue title]" --type=task|bug --priority=[0-4] --parent=[epic-id]
```

Example:
```bash
bd create --title="Add error boundary to chat page" --type=task --priority=2 --parent=ss-abc
```

**Ticket Guidelines:**
- Priority 0-1: Security issues, data loss risks, broken features
- Priority 2: Significant tech debt, performance issues
- Priority 3: Code quality, testing, documentation
- Priority 4: Nice-to-have improvements

**Keep tickets small:**
- One file or one logical change per ticket
- If a change affects multiple files, create parent task with sub-tasks
- Estimate: each ticket should be <2 hours of work

**Include in ticket description:**
- File path(s) affected
- Current behavior/state
- Desired behavior/state
- Why this matters

### 4. ADD DEPENDENCIES

After creating all tickets, add dependencies where order matters:

```bash
bd dep add [dependent-issue] [blocks-issue]
```

**Common dependency patterns:**
- Type fixes before refactors that use those types
- Infrastructure changes before features that need them
- Tests after the code they test is cleaned up
- Parent tasks block their sub-tasks

### 5. VERIFY WITH BD COMMANDS

After creating tickets:
```bash
bd list --status=open  # Show all created tickets
bd stats               # Show project statistics
bd blocked             # Show dependency chain
```

---

## EXECUTION CHECKLIST

- [ ] Phase 1: Launch 3 Explore agents in parallel
- [ ] Phase 2: Review Next.js App Router patterns
- [ ] Phase 3: Check OpenAI ChatKit integration
- [ ] Phase 4: Assess React 19 & TypeScript patterns
- [ ] Phase 5: Review styling and accessibility
- [ ] Phase 6: Assess testing coverage
- [ ] Phase 7: Identify simplification opportunities
- [ ] Phase 8: Check tech stack best practices
- [ ] Output 1: Provide summary to user
- [ ] Output 2: Create Beads epic (note the epic ID)
- [ ] Output 3: Create tickets with --parent=[epic-id] (use parallel bd create for efficiency)
- [ ] Output 4: Add dependencies between tickets
- [ ] Output 5: Run bd stats to confirm
```

---

## CUSTOMIZATION NOTES

This prompt is configured for:
- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + Tailwind CSS 4
- **AI Integration**: OpenAI ChatKit React
- **Language**: TypeScript 5 (strict mode)
- **Deployment**: Vercel

To adapt for other tech stacks:
1. **Different Backend**: Add backend-specific phase (database, API layer)
2. **Different AI**: Replace Phase 3 with your AI integration (Anthropic, local models, etc.)
3. **Additional Checks**: Add industry-specific concerns (HIPAA, PCI, accessibility)
4. **Priority Mapping**: Adjust priority levels based on your team's conventions

## RECOMMENDED FREQUENCY

- **Weekly**: For active development projects
- **Bi-weekly**: For maintenance-mode projects
- **After Major Features**: Before release/merge
- **Quarterly**: For comprehensive debt assessment
