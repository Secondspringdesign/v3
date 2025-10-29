// app/chat/page.tsx
"use client";

import { ChatKitPanel } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCallback, useEffect } from "react";

export default function ChatPage() {
  const { scheme, setScheme } = useColorScheme();

  const handleWidgetAction = useCallback(async () => {}, []);
  const handleResponseEnd = useCallback(() => {}, []);

  // FORCE FULL WIDTH AFTER LOAD
  useEffect(() => {
    const iframe = document.querySelector("iframe");
    if (!iframe) return;

    const check = setInterval(() => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      const chat = doc.querySelector('[data-testid="chatkit-conversation"]') ||
                    doc.querySelector('.chatkit-conversation') ||
                    doc.body;

      if (chat instanceof HTMLElement) {
        chat.style.maxWidth = 'none';
        chat.style.width = '100%';
        chat.style.margin = '0 auto';

        // Force input
        const input = doc.querySelector('[data-testid="chatkit-input"]');
        if (input instanceof HTMLElement) {
          input.style.width = '100%';
          input.style.maxWidth = 'none';
        }

        clearInterval(check);
      }
    }, 100);

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
