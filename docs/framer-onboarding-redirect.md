# Framer Onboarding Redirect

## How it works

This script checks if the logged-in user has completed onboarding:
- If **NOT complete** → redirect to `/ai-portal/onboarding`
- If **complete** → stay on current page (or redirect to `/ai-portal/business` if on onboarding page)

The script uses sessionStorage caching to minimize API calls and improve performance.

## Installation

1. Copy the code snippet below
2. Open your Framer project
3. Go to **Site Settings** → **Custom Code**
4. Paste the code in the **Head** section
5. Publish your site

## Code

```html
<script>
(function() {
  'use strict';

  const API_URL = 'https://secondspring.vercel.app/api/onboarding-status';
  const CACHE_KEY = 'onboarding_status_cache';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  const ONBOARDING_PATH = '/ai-portal/onboarding';
  const BUSINESS_PATH = '/ai-portal/business';

  // Helper: Get Outseta access token
  function getOutsetaToken() {
    try {
      // Try to get token from Outseta's localStorage
      const outsetaAuth = localStorage.getItem('Outseta.nocode.auth');
      if (outsetaAuth) {
        const authData = JSON.parse(outsetaAuth);
        return authData.access_token || authData.accessToken;
      }

      // Fallback: try cookie
      const cookieMatch = document.cookie.match(/(?:^|;\s*)Outseta\.auth=([^;]+)/);
      if (cookieMatch) {
        try {
          const authData = JSON.parse(decodeURIComponent(cookieMatch[1]));
          return authData.access_token || authData.accessToken;
        } catch (e) {
          console.error('[OnboardingRedirect] Failed to parse cookie:', e);
        }
      }

      return null;
    } catch (e) {
      console.error('[OnboardingRedirect] Error getting token:', e);
      return null;
    }
  }

  // Helper: Get cached status
  function getCachedStatus() {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (data.timestamp && (now - data.timestamp) < CACHE_DURATION) {
        return data.onboarding_complete;
      }

      // Cache expired
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    } catch (e) {
      console.error('[OnboardingRedirect] Error reading cache:', e);
      return null;
    }
  }

  // Helper: Set cached status
  function setCachedStatus(onboardingComplete) {
    try {
      const data = {
        onboarding_complete: onboardingComplete,
        timestamp: Date.now()
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[OnboardingRedirect] Error setting cache:', e);
    }
  }

  // Helper: Check onboarding status via API
  async function checkOnboardingStatus(token) {
    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('[OnboardingRedirect] API error:', response.status);
        return false;
      }

      const data = await response.json();
      return data.onboarding_complete || false;
    } catch (e) {
      console.error('[OnboardingRedirect] Fetch error:', e);
      return false;
    }
  }

  // Main: Perform redirect check
  async function performRedirectCheck() {
    const currentPath = window.location.pathname;

    // Check cache first
    const cachedStatus = getCachedStatus();
    if (cachedStatus !== null) {
      console.log('[OnboardingRedirect] Using cached status:', cachedStatus);
      performRedirect(cachedStatus, currentPath);
      return;
    }

    // Get token
    const token = getOutsetaToken();
    if (!token) {
      console.log('[OnboardingRedirect] No auth token found, skipping redirect');
      return;
    }

    // Fetch status from API
    console.log('[OnboardingRedirect] Fetching status from API...');
    const onboardingComplete = await checkOnboardingStatus(token);
    
    // Cache the result
    setCachedStatus(onboardingComplete);
    
    // Perform redirect
    performRedirect(onboardingComplete, currentPath);
  }

  // Helper: Perform the actual redirect
  function performRedirect(onboardingComplete, currentPath) {
    if (!onboardingComplete && currentPath !== ONBOARDING_PATH) {
      console.log('[OnboardingRedirect] Redirecting to onboarding...');
      window.location.href = ONBOARDING_PATH;
    } else if (onboardingComplete && currentPath === ONBOARDING_PATH) {
      console.log('[OnboardingRedirect] Redirecting to business portal...');
      window.location.href = BUSINESS_PATH;
    }
  }

  // Run the check when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', performRedirectCheck);
  } else {
    performRedirectCheck();
  }
})();
</script>
```

## How to Test

1. **Clear your sessionStorage cache** to force a fresh check:
   - Open browser DevTools (F12)
   - Go to **Console** tab
   - Run: `sessionStorage.removeItem('onboarding_status_cache')`

2. **Check the onboarding status**:
   - Open any page in the AI portal
   - Watch the console for `[OnboardingRedirect]` messages
   - Verify you're redirected to the correct page

3. **Test caching**:
   - After the first redirect, reload the page
   - You should see "Using cached status" in the console
   - No API call should be made

## Troubleshooting

### Not redirecting?

- Check browser console for error messages
- Verify the Outseta token is available in localStorage or cookies
- Test the API endpoint directly: `https://secondspring.vercel.app/api/onboarding-status`

### Redirecting to the wrong page?

- Clear the sessionStorage cache (see "How to Test" above)
- Verify the onboarding status in your database
- Check if milestones are being calculated correctly via `/api/onboarding-progress`

### API calls on every page load?

- Verify sessionStorage is enabled in the browser
- Check if cache is being set correctly in DevTools → Application → Session Storage

## Notes

- The cache expires after 5 minutes
- The script runs on every page load but uses the cache to minimize API calls
- Users without authentication tokens are not redirected
- Failed API calls default to `onboarding_complete: false` to avoid blocking access
