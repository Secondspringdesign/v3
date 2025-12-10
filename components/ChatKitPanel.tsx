"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ColorScheme } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
};

type ErrorState = {
  script: string | null;
  session: string | null;
  integration: string | null;
  retryable: boolean;
};

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

// Outseta client surface (partial) for typing
type OutsetaClientSurface = {
  getAccessToken?: () => string | null;
  auth?: { accessToken?: string | null } | null;
};

function getOutsetaClient(): OutsetaClientSurface | null {
  if (!isBrowser) return null;
  const w = window as unknown as {
    Outseta?: OutsetaClientSurface;
    outseta?: OutsetaClientSurface;
  };
  return w.Outseta ?? w.outseta ?? null;
}

// Try to get token via Outseta client API (if present), then fallback to localStorage keys
function findOutsetaTokenOnClient(): string | null {
  if (!isBrowser) return null;

  const out = getOutsetaClient();

  try {
    if (out) {
      // Preferred: getAccessToken() – usually sync returning a string
      if (typeof out.getAccessToken === "function") {
        const tokenOrNull = out.getAccessToken();
        if (typeof tokenOrNull === "string" && tokenOrNull) {
          if (isDev) console.log("[ChatKitPanel] Outseta token from getAccessToken");
          return tokenOrNull;
        }
      }

      // Fallback: cached auth.accessToken
      if (out.auth && typeof out.auth.accessToken === "string" && out.auth.accessToken) {
        if (isDev) console.log("[ChatKitPanel] Outseta token from auth.accessToken");
        return out.auth.accessToken;
      }
    }
  } catch (err) {
    console.warn("[ChatKitPanel] Error while calling Outseta client API:", err);
  }

  // Last resort: legacy localStorage keys (if you used them historically)
  try {
    const localKeys = ["outseta_access_token", "outseta_token", "outseta_auth_token"];
    for (const k of localKeys) {
      const v = window.localStorage.getItem(k);
      if (v) {
        if (isDev) console.log("[ChatKitPanel] Outseta token from localStorage key:", k);
        return v;
      }
    }
  } catch (err) {
    console.warn("[ChatKitPanel] Error while reading localStorage for Outseta token:", err);
  }

  console.warn("[ChatKitPanel] No Outseta token found on client");
  return null;
}

export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<"pending" | "ready" | "error">(
    () => (isBrowser && window.customElements?.get("openai-chatkit") ? "ready" : "pending"),
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);
  const isMobile = useIsMobile();

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((prev) => ({ ...prev, ...updates }));
  }, []);

  // Initialize ChatKit session on mount
  useEffect(() => {
    if (!isBrowser) return;
    isMountedRef.current = true;

    const init = async () => {
      try {
        setIsInitializingSession(true);

        // Give Outseta a brief moment to initialize in the Framer embed
        await new Promise((resolve) => setTimeout(resolve, 100));

        const token = findOutsetaTokenOnClient();

        if (!token) {
          setErrorState({
            session:
              "Unable to find Outseta authentication token. Please make sure you are logged in and reload the page.",
            retryable: true,
          });
          setIsInitializingSession(false);
          return;
        }

        const res = await fetch("/api/create-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-outseta-access-token": `Bearer ${token}`,
          },
          body: JSON.stringify({
            // any payload your API expects for session creation
          }),
        });

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}));
          console.error("[ChatKitPanel] Failed to initialize session:", res.status, errorBody);
          setErrorState({
            session:
              errorBody?.error ??
              "Failed to initialize chat session. Please make sure you are logged in and try again.",
            retryable: true,
          });
          setIsInitializingSession(false);
          return;
        }

        const data = await res.json();
        if (isDev) console.log("[ChatKitPanel] Session initialized:", data);

        // TODO: wire "data" into your <openai-chatkit> element if needed
        // e.g. pass a session id or token via attributes or a global config.

        setIsInitializingSession(false);
      } catch (err) {
        console.error("[ChatKitPanel] Error initializing session:", err);
        setErrorState({
          session: "Error initializing chat session. Please reload the page.",
          retryable: true,
        });
        setIsInitializingSession(false);
      }
    };

    init();

    return () => {
      isMountedRef.current = false;
    };
  }, [setErrorState]);

  // ---- UI rendering ----

  if (errors.session) {
    return (
      <div>
        <p>{errors.session}</p>
        {errors.retryable && (
          <button
            onClick={() => {
              setErrors(createInitialErrors());
              setWidgetInstanceKey((k) => k + 1);
              // Re-run initialization by toggling the key
              // and letting the useEffect above fire again on re-mount.
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isInitializingSession || scriptStatus === "pending") {
    return <div>Loading chat…</div>;
  }

  return (
    <div key={widgetInstanceKey}>
      {/* Replace this with your actual ChatKit widget markup if it differs */}
      <openai-chatkit
        data-theme={theme}
        data-device={isMobile ? "mobile" : "desktop"}
        onOpenaiChatkitWidgetAction={async (event: CustomEvent<FactAction>) => {
          await onWidgetAction(event.detail);
        }}
        onOpenaiChatkitResponseEnd={() => {
          onResponseEnd();
        }}
      />
    </div>
  );
}
