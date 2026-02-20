# Framer Onboarding Progress Bar Embed

## Overview

This document provides the HTML/JavaScript code to embed the onboarding progress bar in Framer with the event-driven relay bridge for realtime updates.

## How It Works

The progress bar receives instant updates when data changes in the Business Hub:

1. **Business Hub** (iframe A) detects database changes via Supabase realtime
2. **Business Hub** sends `postMessage({ type: 'hub-data-changed' })` to parent (Framer page)
3. **Framer page** receives message and relays it to **Progress Bar** (iframe B)
4. **Progress Bar** debounces (300ms) then fetches updated progress

## Installation

### Step 1: Add Progress Bar iframe

Add this iframe to your Framer page where you want the progress bar to appear:

```html
<iframe 
  id="onboarding-progress-bar"
  src="https://secondspring.vercel.app/onboarding-bar"
  width="100%"
  height="120px"
  frameborder="0"
  style="border: none; display: block;">
</iframe>
```

### Step 2: Add Business Hub iframe

The Business Hub should already be embedded on your page:

```html
<iframe 
  id="business-hub"
  src="https://secondspring.vercel.app/business-hub"
  width="100%"
  height="800px"
  frameborder="0"
  style="border: none; display: block;">
</iframe>
```

### Step 3: Add Token Bridge + Relay Script

Add this script to your Framer page's **Custom Code → Head** section:

```html
<script>
(function() {
  'use strict';

  // Helper: Get Outseta access token
  function getOutsetaToken() {
    try {
      // Try localStorage
      const outsetaAuth = localStorage.getItem('Outseta.nocode.auth');
      if (outsetaAuth) {
        const authData = JSON.parse(outsetaAuth);
        return authData.access_token || authData.accessToken;
      }

      // Fallback: cookie
      const cookieMatch = document.cookie.match(/(?:^|;\s*)Outseta\.auth=([^;]+)/);
      if (cookieMatch) {
        try {
          const authData = JSON.parse(decodeURIComponent(cookieMatch[1]));
          return authData.access_token || authData.accessToken;
        } catch (e) {
          console.error('[OnboardingEmbed] Failed to parse cookie:', e);
        }
      }

      return null;
    } catch (e) {
      console.error('[OnboardingEmbed] Error getting token:', e);
      return null;
    }
  }

  // Send token to iframes when requested
  function handleTokenRequest(event) {
    if (event.data?.type === 'request-token') {
      const token = getOutsetaToken();
      if (token) {
        // Send to all iframes (Business Hub and Progress Bar)
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          try {
            iframe.contentWindow?.postMessage(
              { type: 'outseta-token', token: token },
              'https://secondspring.vercel.app'
            );
          } catch (e) {
            // Ignore cross-origin errors
          }
        });
      }
    }
  }

  // Relay data-changed messages from Business Hub to Progress Bar
  function handleDataChanged(event) {
    if (event.data?.type === 'hub-data-changed') {
      const progressIframe = document.getElementById('onboarding-progress-bar');
      if (progressIframe && progressIframe.contentWindow) {
        try {
          progressIframe.contentWindow.postMessage(
            { type: 'data-changed', table: event.data.table },
            'https://secondspring.vercel.app'
          );
        } catch (e) {
          // Ignore cross-origin errors
        }
      }
    }
  }

  // Main message handler
  function handleMessage(event) {
    // Security: only accept messages from our domain
    if (event.origin !== 'https://secondspring.vercel.app') return;
    
    handleTokenRequest(event);
    handleDataChanged(event);
  }

  // Listen for messages
  window.addEventListener('message', handleMessage);

  // Send token to iframes on page load
  window.addEventListener('load', function() {
    const token = getOutsetaToken();
    if (token) {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow?.postMessage(
            { type: 'outseta-token', token: token },
            'https://secondspring.vercel.app'
          );
        } catch (e) {
          // Ignore errors
        }
      });
    }
  });
})();
</script>
```

## How to Test

1. **Check Token Delivery:**
   - Open browser DevTools (F12)
   - Go to **Console** tab
   - Look for `[OnboardingBar]` or `[BusinessHub]` logs
   - Verify token is received

2. **Test Realtime Updates:**
   - Make a change in the Business Hub (e.g., save a fact)
   - Watch the progress bar update within ~300ms
   - Check console for `[OnboardingBar] hub-data-changed` messages

3. **Test Safety Net:**
   - Wait 60 seconds without making changes
   - Progress bar should poll once as a fallback

## Troubleshooting

### Progress bar not updating?

- Check browser console for errors
- Verify both iframes have correct `id` attributes
- Test if Business Hub realtime is working (open Network tab, filter WebSocket)
- Clear browser cache and reload

### Token not being sent?

- Verify Outseta authentication is working
- Check localStorage for `Outseta.nocode.auth` key
- Ensure Framer page is on the same domain as Outseta

### Relay not working?

- Verify the script is in the **Head** section of Framer custom code
- Check that iframe IDs match (`onboarding-progress-bar`, `business-hub`)
- Look for CORS errors in console (should be none with correct origin checks)

## Performance Notes

- **Zero polling overhead** when everything is working (event-driven)
- **300ms debounce** prevents excessive API calls during rapid changes
- **60-second safety net** ensures progress updates even if events are missed
- **Token caching** in localStorage reduces auth overhead

## Security

- Origin checks ensure messages only come from `secondspring.vercel.app`
- Token is never exposed in URLs or logged to console
- CORS protects against unauthorized iframe embedding

## Related Documentation

- [Onboarding Implementation](./onboarding-implementation.md) — Full architecture
- [Framer Onboarding Redirect](./framer-onboarding-redirect.md) — Auto-redirect script
