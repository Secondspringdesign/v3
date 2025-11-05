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

import { saveLocalBookmark, listLocalBookmarks } from "@/lib/localBookmarks";
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

/**
 * Minimal typing for the ChatKit control surface we use.
 */
type ChatKitControl = {
  getActiveThread?: () =>
    | {
        id?: string;
        title?: string;
        messages?: Array<{ text?: string }>;
      }
    | undefined;
  getThreads?: () =>
    | Array<{
        id?: string;
        title?: string;
        updated_at?: string;
      }>
    | undefined;
  openThread?: (id: string) => void;
  openHistory?: () => void;
  [key: string]: unknown;
};

// Outseta client surface (partial) for typing
type OutsetaClientSurface = {
  getAccessToken?: () => string | null;
  getJwtPayload?: () => Record<string, unknown> | null;
  auth?: { accessToken?: string | null } | null;
};

// Try to get token via Outseta client API (if present), then fallback to localStorage keys
function findOutsetaTokenOnClient(): string | null {
  if (!isBrowser) return null;

  const out =
    (window as unknown as { Outseta?: OutsetaClientSurface; outseta?: OutsetaClientSurface }).Outseta ??
    (window as unknown as { Outseta?: OutsetaClientSurface; outseta?: OutsetaClientSurface }).outseta ??
    null;

  try {
    if (out) {
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
    console.warn("Error while calling Outseta client API:", err);
  }

  try {
    const localKeys = ["outseta_access_token", "outseta_token", "outseta_auth_token"];
    for (const k of localKeys) {
      const v = window.localStorage.getItem(k);
      if (v) return v;
    }
  } catch (err) {
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

  // UI state: history panel + selected tab
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historyTab, setHistoryTab] = useState<"chats" | "bookmarks">("chats");

  // Keep track if current active thread is bookmarked (by title+agent or thread id)
  const [activeBookmarked, setActiveBookmarked] = useState(false);

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

        // Get Outseta token
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

  // Determine agent from URL
  const agentFromUrl = isBrowser ? new URLSearchParams(window.location.search).get("agent") ?? "strategy" : "strategy";

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: { colorScheme: theme, ...getThemeConfig(theme) },
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
    onThreadChange: () => {
      processedFacts.current.clear();
      // update activeBookmarked when thread changes
      try {
        const control = chatkit.control as unknown as ChatKitControl;
        const thread = control?.getActiveThread?.();
        const threadTitle = thread?.title ?? (thread?.messages && thread.messages.length ? String(thread.messages[thread.messages.length - 1]?.text ?? "") : null);
        const bookmarks = listLocalBookmarks();
        const found = bookmarks.some((b) => b.title === (threadTitle ?? "") && b.agent === agentFromUrl);
        setActiveBookmarked(found);
      } catch {
        setActiveBookmarked(false);
      }
    },
    onError: ({ error }) => console.error("ChatKit error", error),
  });

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  // Bookmark action: save using chat name (thread.title preferred)
  const handleBookmarkClick = useCallback(async () => {
    try {
      const control = chatkit.control as unknown as ChatKitControl;
      const thread = control?.getActiveThread?.();
      let title = thread?.title ?? null;
      if (!title) {
        const last = thread?.messages && thread.messages.length ? thread.messages[thread.messages.length - 1]?.text ?? "" : "";
        if (last && typeof last === "string") {
          title = last.trim().slice(0, 80);
        } else {
          title = `Conversation ${new Date().toLocaleString()}`;
        }
      }
      // Save bookmark without prompting — per request
      saveLocalBookmark({ agent: agentFromUrl, title, snippet: thread?.messages && thread.messages.length ? thread.messages[thread.messages.length - 1]?.text ?? "" : null, content: thread?.messages ?? null });
      setActiveBookmarked(true);
    } catch (err) {
      console.error("Failed to save bookmark", err);
      alert("Failed to save bookmark");
    }
  }, [chatkit.control, agentFromUrl]);

  // History panel: try to list chat threads if the control supports it
  const renderChatsTab = () => {
    try {
      const control = chatkit.control as unknown as ChatKitControl;
      const threads = control?.getThreads?.();
      if (threads && threads.length) {
        return (
          <div className="p-2 space-y-2">
            {threads.map((t) => (
              <div key={t.id ?? String(t.title)} className="p-2 rounded hover:bg-slate-50 cursor-pointer" onClick={() => { if (t.id && typeof control.openThread === "function") control.openThread(t.id); }}>
                <div className="text-sm font-medium">{t.title ?? "Untitled"}</div>
                <div className="text-xs text-slate-500">{t.updated_at ?? ""}</div>
              </div>
            ))}
          </div>
        );
      }
      // Fallback: show button to open ChatKit's native history (if supported)
      return (
        <div className="p-4">
          <div className="mb-3 text-sm text-slate-700">ChatKit does not expose threads via the client control in this build.</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                try {
                  const control = chatkit.control as unknown as ChatKitControl;
                  if (typeof control.openHistory === "function") control.openHistory();
                  else alert("ChatKit native history is not available via control in this build.");
                } catch {
                  alert("Unable to open native history.");
                }
              }}
              className="px-3 py-1 rounded border text-sm"
            >
              Open Chat history
            </button>
          </div>
        </div>
      );
    } catch (err) {
      return <div className="p-4 text-sm">Unable to list chats.</div>;
    }
  };

  return (
    <div className="relative pb-8 flex h-[90vh] flex-col rounded-2xl overflow-hidden bg-white shadow-sm transition-colors dark:bg-slate-900">
      {/* Controls row (right-aligned icons) - removed Agent badge per request */}
      <div className="px-4 pt-4 flex items-center justify-end gap-2">
        {/* History icon */}
        <button
          title="History"
          onClick={() => {
            setShowHistoryPanel((s) => !s);
            setHistoryTab("chats");
          }}
          className="p-2 rounded hover:bg-slate-100"
          aria-label="Open history"
        >
          {/* History/clock icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 8v5l3 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12a9 9 0 1 1-2.6-6.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Bookmark icon (toggles blue when active) */}
        <button
          title="Bookmark"
          onClick={handleBookmarkClick}
          className={`p-2 rounded hover:bg-slate-100 ${activeBookmarked ? "text-sky-600" : "text-slate-700"}`}
          aria-pressed={activeBookmarked}
          aria-label="Bookmark conversation"
        >
          {/* Bookmark SVG */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill={activeBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 2h12v20l-6-4-6 4V2z" />
          </svg>
        </button>
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

      {/* History panel overlay (right-side) */}
      {showHistoryPanel && (
        <div className="absolute right-4 top-20 z-50 w-[360px] bg-white shadow-lg rounded" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <div className="flex items-center gap-4">
              <button onClick={() => setHistoryTab("chats")} className={`px-3 py-1 rounded ${historyTab === "chats" ? "bg-slate-100 font-medium" : "text-slate-600"}`}>Chats</button>
              <button onClick={() => setHistoryTab("bookmarks")} className={`px-3 py-1 rounded ${historyTab === "bookmarks" ? "bg-slate-100 font-medium" : "text-slate-600"}`}>Bookmarks</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowHistoryPanel(false)} className="px-2 py-1 rounded text-sm">Close</button>
            </div>
          </div>

          <div className="p-2">
            {historyTab === "chats" ? (
              renderChatsTab()
            ) : (
              <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                <LocalBookmarksPanel
                  onOpen={(b) => {
                    try {
                      if (b.snippet) navigator.clipboard?.writeText(String(b.snippet));
                    } catch {}
                    const url = new URL(window.location.href);
                    url.searchParams.set("agent", b.agent);
                    window.location.href = url.toString();
                    setShowHistoryPanel(false);
                    alert("Opened agent. The bookmark snippet (if any) has been copied to your clipboard — paste into the chat to continue.");
                  }}
                />
              </div>
            )}
          </div>
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
