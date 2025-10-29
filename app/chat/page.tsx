// app/chat/page.tsx
"use client";

import { ChatKitPanel } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCallback, useEffect } from "react";

export default function ChatPage() {
  const { scheme, setScheme } = useColorScheme();

  const handleWidgetAction = useCallback(async () => {}, []);
  const handleResponseEnd = useCallback(() => {}, []);

  // FORCE FULL WIDTH IMMEDIATELY
  useEffect(() => {
    const iframe = document.querySelector("iframe");
    if (!iframe) return;

    const forceFullWidth = () => {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      // Apply to all possible containers
      const selectors = [
        '[data-testid="chatkit-conversation"]',
        '.chatkit-conversation',
        '.chatkit-messages',
        'main',
        'body'
      ];

      selectors.forEach(sel => {
        const el = doc.querySelector(sel);
        if (el instanceof HTMLElement) {
          el.style.maxWidth = 'none';
          el.style.width = '100%';
          el.style.margin = '0 auto';
        }
      });

      // Input
      const input = doc.querySelector('[data-testid="chatkit-input"]');
      if (input instanceof HTMLElement) {
        input.style.width = '100%';
        input.style.maxWidth = 'none';
      }
    };

    // Run on load
    iframe.onload = forceFullWidth;

    // Poll until loaded
    const check = setInterval(() => {
      if (iframe.contentDocument?.readyState === 'complete') {
        forceFullWidth();
        clearInterval(check);
      }
    }, 50);

    setTimeout(() => clearInterval(check), 5000);

    return () => clearInterval(check);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-end bg-slate-100 dark:bg-slate-950">
      <div className="w-full p-4">
        <ChatKitPanel
          theme={scheme}
          onWidgetAction={handleWidgetAction}
          onResponseEnd={handleResponseEnd}
          onThemeRequest={setScheme}
        />
      </div>
    </main>
  );
}
