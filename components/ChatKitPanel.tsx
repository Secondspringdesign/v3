// components/ChatKitPanel.tsx
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

import { saveLocalBookmark } from "@/lib/localBookmarks";
import { LocalBookmarksPanel } from "@/components/LocalBookmarksPanel";

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
  getJwtPayload?: () => Record<string, unknown> | null;
  auth?: { accessToken?: string | null } | null;
};

// Try to get token via Outseta client API (if present), then fallback to localStorage keys
function findOutsetaTokenOnClient(): string | null {
  if (!isBrowser) return null;

  // typed access to window.Outseta
  const out = (window as unknown as { Outseta?: OutsetaClientSurface; outseta?: OutsetaClientSurface }).Outseta
    ?? (window as unknown as { Outseta?: OutsetaClientSurface; outseta?: OutsetaClientSurface }).outseta
    ?? null;

  try {
    if (out) {
      // Prefer getAccessToken or getJwtPayload if present
      if (typeof out.getAccessToken === "function") {
        const t = out.getAccessToken();
        if (t) return t;
      }
      if (typeof out.getJwtPayload === "function") {
        const payload = out.getJwtPayload();
        if (payload) {
          if (typeof payload["rawToken"] === "string") return payload["rawToken"] as string;
          if (typeof payload["accessToken"] === "string") return payload["accessToken"] as string;
        }
      }
      if (out.auth && typeof out.auth.accessToken === "string") return out.auth.accessToken as string;
    }
  } catch (err) {
    // Log and continue to fallback
    console.warn("Error while calling Outseta client API:", err);
  }

  // LocalStorage fallback (your o_options uses tokenStorage:'local')
  try {
    const localKeys = ["outseta_access_token", "outseta_token", "outseta_auth_token"];
    for (const k of localKeys) {
      const v = window.localStorage.getItem(k);
      if (v) return v;
    }
  } catch (err) {
    // ignore localStorage access errors
    console.warn("Error while reading localStorage for Outseta token:", err);
  }

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
    () => (isBrowser && window.customElements?.get("openai-chatkit") ? "ready" : "pending")
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);

  const [showBookmarks, setShowBookmarks] = useState(false);

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
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
    if (isBrowser) setScriptStatus(window.customElements?.get("openai-chatkit") ? "ready" : "pending");
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
        const agent = urlParams.get("agent") || "strategy";

        // Get Outseta token (Outseta client API preferred, then localStorage fallback)
        const outsetaToken = findOutsetaTokenOnClient();

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (outsetaToken) headers["Authorization"] = `Bearer ${outsetaToken}`;

        const response = await fetch(`${CREATE_SESSION_ENDPOINT}?agent=${agent}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            user: "public-user",
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
        const detail = error instanceof Error ? error.message : "Unable to start ChatKit session.";
        if (isMountedRef.current) setErrorState({ session: detail, retryable: false });
        throw error instanceof Error ? error : new Error(detail);
      } finally {
        if (isMountedRef.current && !currentSecret) setIsInitializingSession(false);
      }
    },
    [setErrorState]
  );

  // Determine the current agent from the URL (fallback to "strategy")
  const agentFromUrl = isBrowser ? new URLSearchParams(window.location.search).get("agent") ?? "strategy" : "strategy";

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: { colorScheme: theme, ...getThemeConfig(theme) },
    // Use per-agent greeting and prompts:
    startScreen: {
      greeting: getGreetingForAgent(agentFromUrl),
      prompts: getStarterPromptsForAgent(agentFromUrl) ?? STARTER_PROMPTS,
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
        void onWidgetAction({ type: "save", factId: id, factText: text.replace(/\s+/g, " ").trim() });
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
    <div className="relative pb-8 flex h-[90vh] flex-col rounded-2xl overflow-hidden bg-white shadow-sm transition-colors dark:bg-slate-900">
      {/* Small agent header for context + bookmark controls */}
      <div className="px-4 pt-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <span className="font-semibold">Agent:</span>
          <span className="capitalize">{agentFromUrl}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                // try to read the active thread messages from chatkit control if available
                const thread = (chatkit.control as any)?.getActiveThread?.();
                const messages = thread?.messages ?? null;
                const snippet = messages && messages.length ? (messages[messages.length - 1]?.text ?? "") : "";
                const title = window.prompt("Bookmark title", `Conversation ${new Date().toLocaleString()}`) || `Conversation ${new Date().toLocaleString()}`;
                saveLocalBookmark({ agent: agentFromUrl, title, snippet: snippet || null, content: messages ?? null });
                alert("Bookmark saved locally (this device only)");
              } catch (e) {
                console.error("Failed to save local bookmark", e);
                alert("Failed to save bookmark");
              }
            }}
            className="px-2 py-1 rounded border text-sm"
            title="Save bookmark locally"
          >
            Save Bookmark
          </button>

          <button
            onClick={() => setShowBookmarks((s) => !s)}
            className="px-2 py-1 rounded border text-sm"
            title="Open local bookmarks"
          >
            Bookmarks
          </button>
        </div>
      </div>

      <ChatKit
        key={widgetInstanceKey}
        control={chatkit.control}
        className={
          blockingError || isInitializingSession
            ? "pointer-events-none opacity-0"
            : "block flex-1 w-full h-full"
        }
      />

      {/* Local bookmarks panel overlay */}
      {showBookmarks && (
        <div className="absolute right-4 top-20 z-50 w-96 bg-white shadow-lg rounded">
          <LocalBookmarksPanel
            onOpen={(b) => {
              // Copy snippet to clipboard and navigate to the agent
              try {
                if (b.snippet) navigator.clipboard?.writeText(String(b.snippet));
              } catch {}
              const url = new URL(window.location.href);
              url.searchParams.set("agent", b.agent);
              window.location.href = url.toString();
              alert("Opened agent. The bookmark snippet (if any) has been copied to your clipboard — paste into the chat to continue.");
            }}
          />
        </div>
      )}

      <ErrorOverlay
        error={blockingError}
        fallbackMessage={
          blockingError || !isInitializingSession ? null : "Loading assistant session..."
        }
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />
    </div>
  );
}

function extractErrorDetail(
  payload: Record<string, unknown> | undefined,
  fallback: string
): string {
  if (!payload) return fallback;
  const error = payload.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string")
    return (error as { message: string }).message;
  const details = payload.details;
  if (typeof details === "string") return details;
  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") return nestedError;
    if (nestedError && typeof nestedError === "object" && "message" in nestedError && typeof (nestedError as { message?: unknown }).message === "string")
      return (nestedError as { message: string }).message;
  }
  if (typeof payload.message === "string") return payload.message;
  return fallback;
}
