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
  // removed processedFacts – it wasn’t used and caused ESLint errors
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());

  const isMobile = useIsMobile(640); // <= 640px is mobile

  // Derive the agent from the URL query (?agent=...)
  const agent =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("agent") ?? undefined)
      : undefined;

  const greeting = getGreetingForAgent(agent);

  // Desktop: original prompts. Mobile: no starter prompts at all.
  const starterPrompts =
    isMobile === true ? [] : getStarterPromptsForAgent(agent) ?? STARTER_PROMPTS;

  // ----- ChatKit integration state -----

  // Call useChatKit with a minimal, typed options object (no `any`)
  const chatkit = useChatKit({
    api: {}, // ChatKit will use defaults; Outseta token is set below
  });

  // Wire Outseta token into ChatKit
  useEffect(() => {
    if (!chatkit || !isBrowser) return;

    const token = findOutsetaTokenOnClient();
    if (token) {
      chatkit.setAuthToken(token);
    }
  }, [chatkit]);

  const handleWidgetAction = useCallback(
    async (action: FactAction) => {
      await onWidgetAction(action);
    },
    [onWidgetAction],
  );

  const handleResponseEnd = useCallback(() => {
    onResponseEnd();
  }, [onResponseEnd]);

  const handleThemeRequest = useCallback(
    (scheme: ColorScheme) => {
      onThemeRequest(scheme);
    },
    [onThemeRequest],
  );

  const hasAnyError =
    errors.script !== null || errors.session !== null || errors.integration !== null;

  return (
    <>
      {hasAnyError && (
        <ErrorOverlay
          error={errors}
          onRetry={() => setErrors(createInitialErrors())}
        />
      )}

      <ChatKit
        apiBaseUrl={CREATE_SESSION_ENDPOINT}
        theme={getThemeConfig(theme)}
        greeting={greeting}
        startScreen={{
          prompts: starterPrompts,
          placeholder: PLACEHOLDER_INPUT,
        }}
        onWidgetAction={handleWidgetAction}
        onResponseEnd={handleResponseEnd}
        onThemeRequest={handleThemeRequest}
      />
    </>
  );
}
