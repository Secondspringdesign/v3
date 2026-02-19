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
  getMobilePromptsForAgent,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import type { ColorScheme } from "@/hooks/useColorScheme";
import { useIsMobile } from "@/hooks/useIsMobile";

export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
  error?: string;
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

// In-memory fallback so token survives even if storage/cookies are blocked in iframe
let inMemoryOutsetaToken: string | null = null;

function setOutsetaCookie(token: string) {
  if (!isBrowser) return;
  document.cookie = `${OUTSETA_COOKIE_NAME}=${encodeURIComponent(
    token,
  )}; Path=/; SameSite=None; Secure; Max-Age=${OUTSETA_COOKIE_MAX_AGE}; Priority=High`;
}

function stashTokenLocally(token: string) {
  // keep an in-memory copy (works when localStorage/cookies are blocked)
  inMemoryOutsetaToken = token;

  try {
    for (const k of OUTSETA_LS_KEYS) {
      window.localStorage.setItem(k, token);
    }
  } catch (err) {
    console.warn("Unable to write token to localStorage", err);
  }
  setOutsetaCookie(token);
}

/**
 * Decode JWT payload (only client-side decoding of the payload part).
 * Returns null on parse failure.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return null;
    const b = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b + "=".repeat((4 - (b.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch (e) {
    if (isDev) console.warn("[ChatKitPanel] decodeJwtPayload failed", e);
    return null;
  }
}

function findOutsetaTokenOnClient(): string | null {
  if (!isBrowser) return null;

  // prefer in-memory first (bypasses storage/cookie restrictions)
  if (inMemoryOutsetaToken) return inMemoryOutsetaToken;

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

type OutsetaClientSurface = {
  getAccessToken?: () => string | null;
  getJwtPayload?: () => Promise<Record<string, unknown> | null>;
  auth?: { accessToken?: string | null } | null;
};

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
      try {
        stashTokenLocally(tokenFromUrl);
        localStorage.setItem("debug_last_received_token", tokenFromUrl);
        const payload = decodeJwtPayload(tokenFromUrl);
        if (payload?.sub) localStorage.setItem("debug_last_received_sub", String(payload.sub));
        if (isDev) console.log("[ChatKitPanel] stored token from URL and debug keys");
      } catch (e) {
        console.warn("[ChatKitPanel] error storing token from URL", e);
      }
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === PARENT_MESSAGE_TYPE && typeof data.token === "string") {
        if (isDev) console.log("[ChatKitPanel] received token via postMessage from parent");

        try {
          try {
            localStorage.setItem("debug_last_received_token", data.token);
            const payload = decodeJwtPayload(data.token);
            if (payload?.sub) localStorage.setItem("debug_last_received_sub", String(payload.sub));
            if (isDev) console.log("[ChatKitPanel] debug_last_received_sub:", payload?.sub ?? null);
          } catch (err) {
            console.warn("[ChatKitPanel] unable to write debug token values", err);
          }

          // persist (also sets in-memory now)
          stashTokenLocally(data.token);

          try {
            const payload = decodeJwtPayload(data.token);
            const newSub = payload?.sub ? String(payload.sub) : null;

            let prevSub: string | null = null;
            try {
              prevSub = localStorage.getItem("debug_last_received_sub");
            } catch (e) {
              prevSub = null;
            }

            if (newSub) {
              try {
                localStorage.setItem("debug_last_received_sub", newSub);
              } catch (e) {
                // ignore storage errors
              }
            }

            if (newSub && newSub !== prevSub) {
              if (isDev) console.log("[ChatKitPanel] detected user change (sub), reinitializing widget");
              setWidgetInstanceKey((k) => k + 1);
            }
          } catch (e) {
            console.warn("[ChatKitPanel] error checking token sub for reinit", e);
          }

          if (isDev) {
            console.log(
              "[ChatKitPanel] outseta-token persisted (snippet):",
              String(data.token).slice(0, 12) + "...",
            );
          }
        } catch (err) {
          console.warn("[ChatKitPanel] error handling token from parent", err);
        }
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

      try {
        window.parent?.postMessage?.({ type: "chatkit-ready" }, "*");
        if (isDev) console.log("[ChatKitPanel] posted chatkit-ready to parent");
      } catch (e) {
        console.warn("[ChatKitPanel] postMessage(chatkit-ready) failed", e);
      }
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

  // --- click-to-parent handler for opening links on mobile/parent context ---
  useEffect(() => {
    if (!isBrowser) return;
    if (window.parent === window) return; // not inside an iframe

    const handleClick = (ev: MouseEvent) => {
      try {
        const me = ev as MouseEvent & { target: Element | null };
        let el = me.target as Element | null;
        while (el && el !== document.body) {
          if (el instanceof HTMLAnchorElement && el.href) {
            // Prevent iframe navigation and request parent to open the link
            ev.preventDefault();
            window.parent.postMessage({ type: "open_link", url: el.href }, "*");
            return;
          }
          el = el.parentElement;
        }
      } catch (err) {
        // don't break the app if something goes wrong
        console.warn("[ChatKitPanel] click-to-parent handler error", err);
      }
    };

    document.addEventListener("click", handleClick, { passive: false });
    return () => document.removeEventListener("click", handleClick);
  }, []);
  // -------------------------------------------------------------------------

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
  const isMobile = useIsMobile(540);
  const basePrompts = getStarterPromptsForAgent(agentFromUrl) ?? STARTER_PROMPTS;
  const mobilePrompts = getMobilePromptsForAgent(agentFromUrl) ?? basePrompts;
  const effectivePrompts = isMobile === true ? mobilePrompts : basePrompts;

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: themeConfig,
    startScreen: {
      greeting: getGreetingForAgent(agentFromUrl),
      prompts: effectivePrompts,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      attachments: { enabled: true },
    },
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
        const text = String(invocation.params.fact_value ?? "");
        const sourceWorkflow = invocation.params.source_workflow
          ? String(invocation.params.source_workflow)
          : null;

        if (!id) return { success: true };

        const cleanedText = text.replace(/\s+/g, " ").trim();

        // Call API to persist the fact
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const response = await fetch("/api/facts", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              fact_id: id,
              fact_value: cleanedText,
              fact_type_id: invocation.params.fact_type_id ? String(invocation.params.fact_type_id) : null,
              source_workflow: sourceWorkflow,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to save fact";
            console.error("[ChatKitPanel] record_fact API error:", errorMsg);
            void onWidgetAction({
              type: "save",
              factId: id,
              factText: cleanedText,
              error: errorMsg,
            });
            return { success: false, error: errorMsg };
          }

          void onWidgetAction({
            type: "save",
            factId: id,
            factText: cleanedText,
          });
          return { success: true };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Failed to save fact";
          console.error("[ChatKitPanel] record_fact error:", err);
          void onWidgetAction({
            type: "save",
            factId: id,
            factText: cleanedText,
            error: errorMsg,
          });
          return { success: false, error: errorMsg };
        }
      }

      if (invocation.name === "get_facts") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const response = await fetch("/api/tools/get-facts", {
            method: "POST",
            headers,
            credentials: "include",
            body: "{}",
          });

          const raw = await response.text();
          let data: { facts?: unknown; summary?: unknown; error?: unknown } = {};
          if (raw) {
            try {
              data = JSON.parse(raw);
            } catch (err) {
              console.warn("[ChatKitPanel] get_facts: failed to parse JSON", err);
            }
          }

          if (!response.ok) {
            const msg =
              typeof data.error === "string"
                ? data.error
                : "Failed to fetch facts";
            console.error("[ChatKitPanel] get_facts API error:", msg);
            return { success: false, error: msg };
          }

          return {
            success: true,
            facts: Array.isArray(data.facts) ? data.facts : [],
            summary: typeof data.summary === "string" ? data.summary : "",
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to fetch facts";
          console.error("[ChatKitPanel] get_facts error:", err);
          return { success: false, error: msg };
        }
      }

      if (invocation.name === "retrieve_memory") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = {};
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const response = await fetch("/api/memory", {
            method: "GET",
            headers,
            credentials: "include",
          });

          if (!response.ok) {
            if (isDev) console.warn("[ChatKitPanel] retrieve_memory API error:", response.status);
            return { success: true, memory_context: "" };
          }

          const data = (await response.json()) as { memory_context?: string };
          return { success: true, memory_context: data.memory_context ?? "" };
        } catch (err) {
          console.error("[ChatKitPanel] retrieve_memory error:", err);
          return { success: true, memory_context: "" };
        }
      }

      if (invocation.name === "get_planner") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const response = await fetch("/api/planner", {
            method: "GET",
            headers,
            credentials: "include",
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to fetch planner";
            console.error("[ChatKitPanel] get_planner API error:", errorMsg);
            return { success: false, error: errorMsg };
          }

          const data = await response.json();
          return { success: true, planner: data.planner ?? [] };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to fetch planner";
          console.error("[ChatKitPanel] get_planner error:", err);
          return { success: false, error: msg };
        }
      }

      if (invocation.name === "create_planner_item") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const body: Record<string, unknown> = {};
          const fields = ["title", "description", "due_date", "due_period", "pillar_id", "completed", "sort_order", "source_workflow"];
          for (const field of fields) {
            if (invocation.params[field] !== undefined) {
              body[field] = invocation.params[field];
            }
          }

          const response = await fetch("/api/planner", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to create planner item";
            console.error("[ChatKitPanel] create_planner_item API error:", errorMsg);
            return { success: false, error: errorMsg };
          }

          const data = await response.json();
          return { success: true, planner: data.planner };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to create planner item";
          console.error("[ChatKitPanel] create_planner_item error:", err);
          return { success: false, error: msg };
        }
      }

      if (invocation.name === "update_planner_item") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const body: Record<string, unknown> = {};
          const fields = ["id", "title", "description", "due_date", "due_period", "pillar_id", "completed", "sort_order"];
          for (const field of fields) {
            if (invocation.params[field] !== undefined) {
              body[field] = invocation.params[field];
            }
          }

          const response = await fetch("/api/planner", {
            method: "PATCH",
            headers,
            credentials: "include",
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to update planner item";
            console.error("[ChatKitPanel] update_planner_item API error:", errorMsg);
            return { success: false, error: errorMsg };
          }

          const data = await response.json();
          return { success: true, planner: data.planner };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to update planner item";
          console.error("[ChatKitPanel] update_planner_item error:", err);
          return { success: false, error: msg };
        }
      }

      if (invocation.name === "get_goals") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const response = await fetch("/api/goals", {
            method: "GET",
            headers,
            credentials: "include",
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to fetch goals";
            console.error("[ChatKitPanel] get_goals API error:", errorMsg);
            return { success: false, error: errorMsg };
          }

          const data = await response.json();
          return { success: true, goals: data.goals ?? [] };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to fetch goals";
          console.error("[ChatKitPanel] get_goals error:", err);
          return { success: false, error: msg };
        }
      }

      if (invocation.name === "create_goal") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const body: Record<string, unknown> = {};
          const fields = ["title", "description", "time_horizon", "pillar_id", "status", "sort_order", "source_workflow"];
          for (const field of fields) {
            if (invocation.params[field] !== undefined) {
              body[field] = invocation.params[field];
            }
          }

          const response = await fetch("/api/goals", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to create goal";
            console.error("[ChatKitPanel] create_goal API error:", errorMsg);
            return { success: false, error: errorMsg };
          }

          const data = await response.json();
          return { success: true, goal: data.goal };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to create goal";
          console.error("[ChatKitPanel] create_goal error:", err);
          return { success: false, error: msg };
        }
      }

      if (invocation.name === "update_goal") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const body: Record<string, unknown> = {};
          const fields = ["id", "title", "description", "time_horizon", "pillar_id", "status", "sort_order"];
          for (const field of fields) {
            if (invocation.params[field] !== undefined) {
              body[field] = invocation.params[field];
            }
          }

          const response = await fetch("/api/goals", {
            method: "PATCH",
            headers,
            credentials: "include",
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to update goal";
            console.error("[ChatKitPanel] update_goal API error:", errorMsg);
            return { success: false, error: errorMsg };
          }

          const data = await response.json();
          return { success: true, goal: data.goal };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to update goal";
          console.error("[ChatKitPanel] update_goal error:", err);
          return { success: false, error: msg };
        }
      }

      if (invocation.name === "get_documents") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const response = await fetch("/api/documents", {
            method: "GET",
            headers,
            credentials: "include",
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to fetch documents";
            console.error("[ChatKitPanel] get_documents API error:", errorMsg);
            return { success: false, error: errorMsg };
          }

          const data = await response.json();
          return { success: true, documents: data.documents ?? [] };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to fetch documents";
          console.error("[ChatKitPanel] get_documents error:", err);
          return { success: false, error: msg };
        }
      }

      if (invocation.name === "save_document") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const body: Record<string, unknown> = {};
          const fields = ["document_type", "title", "content"];
          for (const field of fields) {
            if (invocation.params[field] !== undefined) {
              body[field] = invocation.params[field];
            }
          }

          // If content is a string (markdown), wrap it in the standard JSONB format
          if (typeof body.content === "string") {
            body.content = { markdown: body.content };
          }

          const response = await fetch("/api/documents", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to save document";
            console.error("[ChatKitPanel] save_document API error:", errorMsg);
            return { success: false, error: errorMsg };
          }

          const data = await response.json();
          return { success: true, document: data.document };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to save document";
          console.error("[ChatKitPanel] save_document error:", err);
          return { success: false, error: msg };
        }
      }

      if (invocation.name === "update_document") {
        try {
          const outsetaToken = findOutsetaTokenOnClient();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (outsetaToken) {
            headers["Authorization"] = `Bearer ${outsetaToken}`;
          }

          const body: Record<string, unknown> = {};
          const fields = ["id", "document_type", "title", "content"];
          for (const field of fields) {
            if (invocation.params[field] !== undefined) {
              body[field] = invocation.params[field];
            }
          }

          // If content is a string (markdown), wrap it in the standard JSONB format
          if (typeof body.content === "string") {
            body.content = { markdown: body.content };
          }

          const response = await fetch("/api/documents", {
            method: "PATCH",
            headers,
            credentials: "include",
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = (errorData as { error?: string }).error ?? "Failed to update document";
            console.error("[ChatKitPanel] update_document API error:", errorMsg);
            return { success: false, error: errorMsg };
          }

          const data = await response.json();
          return { success: true, document: data.document };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to update document";
          console.error("[ChatKitPanel] update_document error:", err);
          return { success: false, error: msg };
        }
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

function createInitialErrors(): ErrorState {
  return {
    script: null,
    session: null,
    integration: null,
    retryable: false,
  };
}
