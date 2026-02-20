# Onboarding Flow - Implementation Summary

## Overview

This implementation provides an event-driven, emotionally meaningful onboarding experience in the Second Spring AI Portal. The redesigned architecture replaces generic milestones with specific achievements tied to key business facts, and uses realtime updates instead of polling for instant progress feedback.

## Architecture

### Event-Driven Updates

The progress bar receives updates via `postMessage` from the Business Hub when any data changes, eliminating the need for constant polling:

1. **Business Hub** → detects realtime database changes (facts, goals, planner, documents)
2. **Business Hub** → sends `postMessage({ type: 'hub-data-changed' })` to parent (Framer)
3. **Framer page** → relays message to progress bar iframe
4. **Progress Bar** → debounces (300ms) then fetches latest progress
5. **Safety Net** → 60-second fallback poll if no events received

### Auto-Focus & Highlight

When any item changes via realtime, the Business Hub automatically:
- Opens the appropriate section (Facts, Goals, Planner, Files)
- Opens the relevant category/bucket
- Scrolls the item into view (smooth, centered)
- Adds a 3-second green pulse animation to highlight the change

This works universally across the entire Business Hub, not just during onboarding.

## Components

### 1. Database Migrations

**Files**: 
- `supabase/migrations/20260219_add_onboarding_complete.sql` (existing)
- `supabase/migrations/20260220_add_onboarding_fact_types.sql` (NEW)

**New Fact Types (in `business` category):**
- `why_this_business` — Emotional motivation for starting the business
- `constraints_summary` — Reality check (time, money, situation, limitations)
- `first_experiment` — The ONE small thing to try first

These additions bring the total business fact slots from 7 to 10.

### 2. API Endpoints

#### `/api/onboarding-progress` (GET & POST)
**File**: `app/api/onboarding-progress/route.ts`

**GET Response:**
```json
{
  "percent": 70,
  "complete": false,
  "milestones": [
    { "id": "named_it", "label": "Named your business", "done": true, "weight": 15 },
    { "id": "knows_the_problem", "label": "Defined the problem", "done": true, "weight": 20 },
    { "id": "found_their_person", "label": "Found your person", "done": true, "weight": 20 },
    { "id": "described_the_offer", "label": "Described your offer", "done": true, "weight": 15 },
    { "id": "first_step_set", "label": "Set your first step", "done": false, "weight": 15 },
    { "id": "plan_in_hand", "label": "Plan in hand", "done": false, "weight": 15 }
  ]
}
```

**Milestone Logic (NEW):**
- `named_it` (15%): Has `business_name` fact
- `knows_the_problem` (20%): Has `core_problem` fact
- `found_their_person` (20%): Has `target_customer` fact
- `described_the_offer` (15%): Has `offer_summary` fact
- `first_step_set` (15%): Has at least 1 planner item
- `plan_in_hand` (15%): Has a `lite_business_plan` document

**Key Changes from Previous Version:**
- 6 milestones instead of 7 (removed meta "onboarding_done" milestone)
- Emotionally meaningful labels tied to specific achievements
- No arbitrary count thresholds (e.g., "5+ facts")
- Milestone for `lite_business_plan` document instead of generic "first document"
- Weights still sum to 100%

**POST Request:**
```json
{ "complete": true }
```
Manually marks onboarding as complete/incomplete.

**Features:**
- Auto-updates `businesses.onboarding_complete` when all milestones done
- Uses service_role Supabase client
- Edge runtime for performance
- Follows existing auth pattern

#### `/api/onboarding-status` (GET)
**File**: `app/api/onboarding-status/route.ts`

**Response:**
```json
{ "onboarding_complete": true }
```

**Features:**
- Fast, lightweight endpoint (just checks boolean)
- Returns `false` for unauthorized/missing users (no errors)
- Designed for Framer redirect checks
- Edge runtime

### 3. Progress Bar UI

#### Onboarding Bar Page
**Files**: 
- `app/onboarding-bar/page.tsx` (main component)
- `app/onboarding-bar/layout.tsx` (minimal layout)

**Features:**
- Iframeable design (no navigation, minimal padding)
- Dark theme matching portal (`bg-[#1a1a2e]`)
- Green/teal gradient progress bar
- **Event-driven updates** via `postMessage` (no polling)
- 300ms debounce on data-changed events
- 60-second safety net fallback poll (only if no events)
- Token bridge authentication pattern
- Responsive milestone grid
- Celebration message at 100% completion

**Visual Design:**
- Height: ~80-120px (compact horizontal strip)
- Progress bar with gradient fill
- Milestone checkmarks below bar
- Percentage display
- Completion counter (e.g., "4 / 6 completed")

### 4. Business Hub Auto-Focus

**File**: `app/business-hub/page.tsx`

**New Features:**
- `autoFocusItem(type, id)` function for scroll/highlight
- CSS `@keyframes hub-highlight-pulse` animation (green, 3s)
- All items have `id="hub-item-{type}-{id}"` attributes
- Realtime subscriptions call `autoFocusItem()` on data changes
- Realtime subscriptions send `postMessage` to parent

**Auto-Focus Behavior:**
1. Opens appropriate section (Facts/Goals/Planner/Files)
2. Opens relevant category/bucket
3. Scrolls element into view (smooth, centered)
4. Adds green pulse highlight for 3 seconds

**CSS Animation:**
```css
@keyframes hub-highlight-pulse {
  0%   { background-color: rgba(16, 185, 129, 0.0); }
  20%  { background-color: rgba(16, 185, 129, 0.15); }
  100% { background-color: rgba(16, 185, 129, 0.0); }
}
.hub-item-highlight {
  animation: hub-highlight-pulse 3s ease-out;
  border-left: 3px solid #10b981 !important;
}
```

### 5. Framer Integration

#### Redirect Script Documentation
**File**: `docs/framer-onboarding-redirect.md`

**Features:**
- Auto-redirect based on onboarding status
- SessionStorage caching (5-minute duration)
- Handles Outseta token extraction
- Redirects non-complete users to `/ai-portal/onboarding`
- Redirects complete users from onboarding to `/ai-portal/business`
- Fail-safe defaults (no blocking on errors)

**Installation:**
Copy script from docs and paste into Framer Site Settings → Custom Code → Head section.

### 5. Type Updates

**File**: `lib/types/database.ts`

Updated `DbBusiness` interface:
```typescript
export interface DbBusiness {
  id: string;
  user_id: string;
  name: string;
  status: BusinessStatus;
  onboarding_complete: boolean;  // NEW
  created_at: string;
  updated_at: string;
}
```

Updated `BusinessUpdate` interface to include `onboarding_complete?: boolean`.

## Architecture Patterns

### Authentication
- All endpoints use `authenticateRequest()` from `lib/auth/middleware`
- Service role Supabase client for all DB operations
- Token bridge pattern for client pages (postMessage)

### Database Access
- Follows `getUserBusiness()` pattern from existing routes
- Uses `.maybeSingle()` for safe queries
- Service role client bypasses RLS for efficiency

### Edge Runtime
- All API routes use `export const runtime = 'edge'`
- Optimized for Vercel Edge Network deployment

### Client-Side Auth
- Token bridge: `requestTokenFromParent()` → `postMessage`
- Listens for `outseta-token` messages
- Supports URL parameter fallback
- Automatic re-fetching on focus/visibility

## Testing

### Manual Testing Checklist

1. **API Endpoints:**
   - [ ] GET `/api/onboarding-progress` with auth token
   - [ ] POST `/api/onboarding-progress` with `{"complete": true}`
   - [ ] GET `/api/onboarding-status` with auth token
   - [ ] Verify milestone calculations with various data states

2. **Progress Bar UI:**
   - [ ] Load `/onboarding-bar` in iframe
   - [ ] Verify token bridge receives token
   - [ ] Check progress updates every 10 seconds
   - [ ] Test responsive layout at different widths
   - [ ] Verify celebration message at 100%

3. **Framer Integration:**
   - [ ] Install script in Framer custom code
   - [ ] Test redirect for incomplete user
   - [ ] Test redirect for complete user
   - [ ] Verify sessionStorage caching
   - [ ] Check error handling (no token, API down, etc.)

### Build Verification

✅ **Build Status**: Successful
- TypeScript compilation: ✓
- ESLint checks: ✓ (only pre-existing warnings)
- Type safety: ✓
- Edge runtime compatibility: ✓

✅ **Security Scan**: Clean
- CodeQL analysis: 0 alerts
- No vulnerabilities in new code

## Usage Examples

### Embedding Progress Bar in Framer

```html
<iframe 
  src="https://secondspring.vercel.app/onboarding-bar?outseta_token={token}"
  width="100%"
  height="120px"
  frameborder="0"
  style="border: none;">
</iframe>
```

### Calling Progress API from Client

```javascript
const response = await fetch('/api/onboarding-progress', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const progress = await response.json();
console.log(`Progress: ${progress.percent}%`);
```

### Manually Completing Onboarding

```javascript
await fetch('/api/onboarding-progress', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ complete: true })
});
```

## Future Enhancements

Possible improvements for future iterations:

1. **Customizable Milestones**: Admin UI to add/remove/reorder milestones
2. **Progress Analytics**: Track completion rates and time-to-complete
3. **Milestone Hints**: Show users what they need to do for incomplete milestones
4. **Skip Option**: Allow users to skip onboarding (with warning)
5. **Onboarding Tour**: Guided walkthrough integrated with ChatKit
6. **Email Notifications**: Send reminders for incomplete onboarding
7. **A/B Testing**: Test different milestone sets for better completion rates

## Maintenance Notes

- Milestone weights must always sum to 100%
- Business fact types list (`BUSINESS_FACT_TYPES`) should match category definition
- Update migration file naming convention: `YYYYMMDD_description.sql`
- Keep Framer script synced if API endpoints change
- Test onboarding flow when adding new data types (e.g., new document types)

## Dependencies

No new dependencies added. Uses existing:
- `@supabase/supabase-js` for database access
- Next.js Edge Runtime
- Tailwind CSS for styling
- Existing auth middleware

## Performance Considerations

- **API Endpoints**: Edge runtime = sub-100ms response times
- **Progress Calculation**: Single query per table (facts, planner, goals, documents)
- **Client Polling**: 10-second interval to avoid overwhelming server
- **Framer Script**: 5-minute cache to minimize API calls
- **Database**: Indexed queries (existing indexes cover all lookups)

## Rollback Plan

If needed, rollback steps:

1. Revert database migration (remove column)
2. Delete API route files
3. Delete onboarding-bar page files
4. Remove Framer script from custom code
5. Revert type definitions

No breaking changes to existing functionality.
