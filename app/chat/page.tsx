// app/chat/page.tsx
"use client";

import { ChatKitPanel } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCallback, useEffect } from "react";

export default function ChatPage() {
  const { scheme, setScheme } = useColorScheme();

  const handleWidgetAction = useCallback(async () => {}, []);
  const handleResponseEnd = useCallback(() => {}, []);

  // SAME-TAB + RESPONSIVE
  useEffect(() => {
    const iframe = document.querySelector("iframe");
    if (!iframe) return;

    const forceSameTab = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // 1. KILL NEW TABS — ChatKit hard-codes target="_blank"
      const style = doc.createElement("style");
      style.textContent = `
        a, a * { 
          target: _self !important; 
          cursor: pointer !important;
        }
        a[ target="_blank" ] { target: _self !important; }
      `;
      doc.head.appendChild(style);

      // 2. RESPONSIVE (your original code)
      const chat = doc.querySelector('[data-testid="chatkit-conversation"]') ||
                    doc.querySelector('.chatkit-conversation') ||
                    doc.body;

      if (chat instanceof HTMLElement) {
        chat.style.minWidth = '600px';
        chat.style.width = '100%';
        chat.style.maxWidth = 'none';
        chat.style.margin = '0 auto';
        chat.style.padding = '0 20px';

        const input = doc.querySelector('[data-testid="chatkit-input"]');
        if (input instanceof HTMLElement) {
          input.style.width = '100%';
          input.style.maxWidth = 'none';
        }

        void chat.offsetHeight;
      }
    };

    iframe.onload = forceSameTab;
    const observer = new ResizeObserver(forceSameTab);
    observer.observe(iframe);

    const poll = setInterval(() => {
      if (iframe.contentDocument?.readyState === 'complete') forceSameTab();
    }, 100);

    setTimeout(() => clearInterval(poll), 5000);

    return () => {
      observer.disconnect();
      clearInterval(poll);
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-end bg-slate-100 dark:bg-slate-950">
      <div className="w-full min-w-[600px] p-4">
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
