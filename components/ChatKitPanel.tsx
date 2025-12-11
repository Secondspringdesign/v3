"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  CREATE_SESSION_ENDPOINT,
  getThemeConfig,
  getGreetingForAgent,
  getStarterPromptsForAgent,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import type { ColorScheme } from "@/hooks/useColorScheme";
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

const OUTSETA_COOKIE_NAME = "outseta_access_token";
const OUTSETA_COOKIE_MAX_AGE = 60 * 60 * 4; // 4 hours
const OUTSETA_LS_KEYS = ["outseta_access_token", "outseta_token", "outseta_auth_token"];
const PARENT_MESSAGE_TYPE = "outseta-token";

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

type OutsetaClientSurface = {
  getAccessToken?: () => string | null;
  getJwtPayload?: () => Promise<Record<string, unknown> | null>;
  auth?: { accessToken?: string | null } | null;
};

function setOutsetaCookie(token: string) {
  if (!isBrowser) return;
  const secure = location.protocol === "https:" ? "Secure; " : "";
  document.cookie = `${OUTSETA_COOKIE_NAME}=${encodeURIComponent(
    token,
  )}; Path=/; SameSite=Lax; Max-Age=${OUTSETA_COOKIE_MAX_AGE}; ${secure}Priority=High`;
}

function stashTokenLocally(token: string) {
  try {
    for (const k of OUTSETA_LS_KEYS) {
      window.localStorage.setItem(k, token);
    }
  } catch (err) {
    console.warn("Unable to write token to localStorage", err);
  }
  setOutsetaCookie(token);
}

function findOutsetaTokenOnClient(): string | null {
  if (!isBrowser) return null;

  const w = window as unknown as {
    Outseta?: OutsetaClientSurface;
    outseta?: OutsetaClientSurface;
  };

  const out = w.Outseta ?? w.outseta ?? null;

  try {
    if (out) {
      if (typeof out.getAccessToken === "function") {
        const tokenOrNull = out.getAccessToken();
        if (typeof tokenOrNull === "string" && tokenOrNull) {
          if (isDev) console.log("[ChatKitPanel] Outseta token from getAccessToken()");
          return tokenOrNull;
        }
      }
      if (out.auth && typeof out.auth.accessToken === "string" && out.auth.accessToken) {
        if (isDev) console.log("[ChatKitPanel] Outseta token from auth.accessToken");
        return out.auth.accessToken;
      }
    }
  } catch (err) {
    console.warn("Error while calling Outseta client API:", err);
  }

  try {
    for (const k of OUTSETA_LS_KEYS) {
      const v = window.localStorage.getItem(k);
      if (v) {
        if (isDev) console.log("[ChatKitPanel] Outseta token from localStorage key:", k);
        return v;
      }
    }
  } catch (err) {
    console.warn("Error while reading localStorage for Outseta token:", err);
  }

  if (isDev) console.warn("[ChatKitPanel] No Outseta token found on client");
  return null;
}

async function waitForOutsetaToken(maxAttempts = 20, delayMs = 500): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const token = findOutsetaTokenOnClient();
    if (token) {
      if (isDev) console.log("[ChatKitPanel] waitForOutsetaToken: got token on attempt", attempt);
      return token;
    }
    if (isDev) {
      console.log(
        "[ChatKitPanel] waitForOutsetaToken: no token yet, attempt",
        attempt,
        "of",
        maxAttempts,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  if (isDev) console.warn("[ChatKitPanel] waitForOutsetaToken: giving up, no token found");
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

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Listen for parent -> iframe token and URL override
  useEffect(() => {
    if (!isBrowser) return;

    const url = new URL(window.location.href);
    const tokenFromUrl = url.searchParams.get("outseta_token");
    if (tokenFromUrl) {
      if (isDev) console.log("[ChatKitPanel] using outseta_token from URL");
      stashTokenLocally(tokenFromUrl);
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === PARENT_MESSAGE_TYPE && typeof data.token === "string") {
        if (isDev) console.log("[ChatKitPanel] received token via postMessage from parent");
        stashTokenLocally(data.token);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!isBrowser) return;

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) return;
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      console.error("Failed to load chatkit.js", event);
      if (!isMountedRef.current) return;
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener("chatkit-script-error", handleError as EventListener);

    if (window.customElements?.get("openai-chatkit")) handleLoaded();
    else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(new CustomEvent("chatkit-script-error", { detail: "ChatKit unavailable." }));
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener("chatkit-script-error", handleError as EventListener);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [scriptStatus, setErrorState]);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    if (isBrowser)
      setScriptStatus(window.customElements?.get("openai-chatkit") ? "ready" : "pending");
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) console.info("[ChatKitPanel] getClientSecret invoked");

      if (isMountedRef.current) {
        if (!currentSecret) setIsInitializingSession(true);
        setErrorState({ session: null, integration: null, retryable: false });
      }

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const agent = urlParams.get("agent") || "business";

        if (isDev) console.log("[ChatKitPanel] Waiting for Outseta access token…");
        const outsetaToken = await waitForOutsetaToken();
        if (isDev) console.log("[ChatKitPanel] Outseta token present:", !!outsetaToken);

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (outsetaToken) {
          headers["Authorization"] = `Bearer ${outsetaToken}`;
          stashTokenLocally(outsetaToken);
        }

        const response = await fetch(`${CREATE_SESSION_ENDPOINT}?agent=${agent}`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            chatkit_configuration: { file_upload: { enabled: true } },
          }),
        });

        const raw = await response.text();
        let data: Record<string, unknown> = {};
        if (raw) {
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch (parseError) {
            console.error("Failed to parse create-session response", parseError);
          }
        }

        if (!response.ok) {
          const detail = extractErrorDetail(data, response.statusText);
          throw new Error(detail);
        }

        const clientSecret = data?.client_secret as string | undefined;
        if (!clientSecret) throw new Error("Missing client secret");

        if (isMountedRef.current) setErrorState({ session: null, integration: null });

        return clientSecret;
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unable to start ChatKit session.";
        if (isMountedRef.current) setErrorState({ session: detail, retryable: false });
        throw error instanceof Error ? error : new Error(detail);
      } finally {
        if (isMountedRef.current && !currentSecret) setIsInitializingSession(false);
      }
    },
    [setErrorState],
  );

  const agentFromUrl = isBrowser
    ? new URLSearchParams(window.location.search).get("agent") ?? "business"
    : "business";

  const themeConfig = getThemeConfig(theme);

  const isMobile = useIsMobile(640);
  const basePrompts = getStarterPromptsForAgent(agentFromUrl) ?? STARTER_PROMPTS;
  const effectivePrompts = isMobile === true ? [] : basePrompts;

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: themeConfig,
    startScreen: {
      greeting: getGreetingForAgent(agentFromUrl),
      prompts: effectivePrompts,
    },
    composer: { placeholder: PLACEHOLDER_INPUT, attachments: { enabled: true } },
    threadItemActions: { feedback: false },
    onClientTool: async (invocation: { name: string; params: Record<string, unknown> }) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          onThemeRequest(requested);
          return { success: true };
        }
        return { success: false };
      }

      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) return { success: true };
        processedFacts.current.add(id);
        void onWidgetAction({
          type: "save",
          factId: id,
          factText: text.replace(/\s+/g, " ").trim(),
        });
        return { success: true };
      }

      return { success: false };
    },
    onResponseEnd: onResponseEnd,
    onResponseStart: () => setErrorState({ integration: null, retryable: false }),
    onThreadChange: () => processedFacts.current.clear(),
    onError: ({ error }) => console.error("ChatKit error", error),
  });

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  return (
    <div className="relative flex h-[95vh] w-full flex-col rounded-3xl overflow-hidden">
      <ChatKit
        key={widgetInstanceKey}
        control={chatkit.control}
        className={
          blockingError || isInitializingSession
            ? "pointer-events-none opacity-0"
            : "second-spring-chat block h-full w-full"
        }
      />
      <ErrorOverlay
        error={blockingError}
        fallbackMessage={
          blockingError || !isInitializingSession ? null : "Loading your session..."
        }
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />
    </div>
  );
}

function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string,
): string {
  if (!payload) return fallback;
  const error = payload.error;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  )
    return (error as { message: string }).message;
  const details = payload.details;
  if (typeof details === "string") return details;
  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") return nestedError;
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    )
      return (nestedError as { message: string }).message;
  }
  if (typeof payload.message === "string") return payload.message;
  return fallback;
}
