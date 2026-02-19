# Onboarding Flow - Implementation Summary

## Overview

This implementation provides a complete foundation for tracking and displaying user onboarding progress in the Second Spring AI Portal.

## Components Created

### 1. Database Migration
**File**: `supabase/migrations/20260219_add_onboarding_complete.sql`

- Adds `onboarding_complete` boolean column to `businesses` table
- Defaults to `false`
- Automatically updated when all milestones are complete
- RLS policies already cover this column (no additional policies needed)

### 2. API Endpoints

#### `/api/onboarding-progress` (GET & POST)
**File**: `app/api/onboarding-progress/route.ts`

**GET Response:**
```json
{
  "percent": 50,
  "complete": false,
  "milestones": [
    { "id": "business_name", "label": "Name your business", "done": true, "weight": 15 },
    { "id": "business_facts_3", "label": "Add 3+ business facts", "done": true, "weight": 20 },
    { "id": "total_facts_5", "label": "Fill out 5+ total facts", "done": true, "weight": 15 },
    { "id": "first_planner_item", "label": "Create your first task", "done": false, "weight": 15 },
    { "id": "first_goal", "label": "Set your first goal", "done": false, "weight": 15 },
    { "id": "first_document", "label": "Upload your first file", "done": false, "weight": 10 },
    { "id": "onboarding_done", "label": "Complete onboarding", "done": false, "weight": 10 }
  ]
}
```

**Milestone Logic:**
- `business_name` (15%): Has a fact with `fact_type_id` or `fact_id` = 'business_name'
- `business_facts_3` (20%): At least 3 facts with `fact_type_id` in business category
- `total_facts_5` (15%): At least 5 total facts
- `first_planner_item` (15%): At least 1 planner item
- `first_goal` (15%): At least 1 goal
- `first_document` (10%): At least 1 document
- `onboarding_done` (10%): All previous milestones complete

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
- Real-time updates (polls every 10 seconds)
- Token bridge authentication pattern
- Responsive milestone grid
- Celebration message at 100% completion

**Visual Design:**
- Height: ~80-120px (compact horizontal strip)
- Progress bar with gradient fill
- Milestone checkmarks below bar
- Percentage display
- Completion counter (e.g., "3 / 7 completed")

### 4. Framer Integration

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
