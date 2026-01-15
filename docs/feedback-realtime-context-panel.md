# Feedback: Real-time Context Panel Architecture

**Date:** 2026-01-15
**From:** Jon
**To:** Christian
**Re:** Your proposal for Supabase Realtime + Context Panel

---

## Your Proposal Summary

- Right panel = memory hub
- Two tabs: Facts + Files
- Search only in Files (can change later)
- Agents write to DB
- Panel updates realtime via Supabase Realtime
- Integrations can plug in later without breaking anything

---

## ✅ What Looks Good

**Supabase Realtime** is the right choice:
- Built into Supabase Pro (no extra cost)
- Respects RLS policies automatically
- Handles reconnection/backoff gracefully
- Filter by `business_id` reduces noise

**Single source of truth** - having agents, users, and future integrations all write to the same tables keeps the architecture clean.

---

## 🤔 Implementation Considerations

### 1. Authentication for Realtime

Supabase Realtime requires authentication. On the client, you'll need to initialize with the user's JWT:

```typescript
// Context Panel needs the user's Supabase session
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Need to pass the Outseta JWT or create a Supabase session
  }
});
```

**Question:** How is the Context Panel currently authenticating API calls? We may need to add a Supabase client-side auth flow or create a bridge between Outseta JWT and Supabase auth.

### 2. Fact ID Dictionary

For the structured facts display, I'd suggest defining canonical fact IDs with categories:

```typescript
const FACT_SCHEMA = {
  identity: [
    { id: 'company_name', label: 'Company Name', required: true },
    { id: 'mission', label: 'Mission' },
    { id: 'industry', label: 'Industry' },
    { id: 'founding_year', label: 'Founded' },
  ],
  audience: [
    { id: 'target_audience', label: 'Target Audience' },
    { id: 'customer_pain_points', label: 'Customer Pain Points' },
    { id: 'value_proposition', label: 'Value Proposition' },
  ],
  goals: [
    { id: 'current_goals', label: 'Current Goals' },
    { id: 'growth_stage', label: 'Growth Stage' },
  ],
};
```

This gives you the "predefined areas" you mentioned - sections that show placeholders until filled.

### 3. Table Name: `files` vs `documents`

We have a `documents` table already (Phase 1 placeholder). Should we:
- Use `documents` as-is?
- Rename to `files` for clarity?
- Keep `documents` for structured content and add `files` for uploads?

### 4. Realtime Subscription Code

Basic pattern for subscribing to changes:

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`facts:${businessId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'facts',
      filter: `business_id=eq.${businessId}`,
    }, handleFactChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [businessId]);
```

---

## Questions Before You Start

1. **Auth flow**: Is the Context Panel making API calls directly to Supabase, or going through our Next.js API routes? For Realtime, you'll need a direct Supabase client connection.

2. **Files scope**: What types of files are we tracking? User uploads? Generated documents? Links to external files?

3. **Edit permissions**: Can users edit facts directly in the Context Panel, or only view what agents have recorded?

---

## Next Steps

The architecture looks clean. The main complexity will be getting Supabase Realtime authenticated with our Outseta-based auth system.

Options:
1. **Supabase custom JWT** - Configure Supabase to accept Outseta JWTs directly
2. **Token exchange** - Server-side endpoint that exchanges Outseta JWT for Supabase session
3. **Service role for reads** - Use anon key with RLS for realtime (if RLS is properly configured)

Let me know which direction you want to explore and I can help with implementation.
