"use client";

import { ChatKitPanel } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCallback, useEffect } from "react";
import { GREETING } from "@/lib/config";

export default function ChatPage() {
  const { scheme, setScheme } = useColorScheme();

  const handleWidgetAction = useCallback(async () => {}, []);
  const handleResponseEnd = useCallback(() => {}, []);

  useEffect(() => {
    const iframe = document.querySelector("iframe");
    if (!iframe) return;

    const injectWelcome = (doc: Document) => {
      const chatContainer = doc.querySelector('[data-testid="chatkit-conversation"]') || doc.querySelector('.chatkit-conversation') || doc.body;
      if (!chatContainer) return;

      const hasWelcome = chatContainer.innerHTML.includes("Business Builder AI");
      if (hasWelcome) return;

      const welcomeHTML = `
        <div class="chatkit-message bot">
          <div class="chatkit-bubble">
            ${GREETING.replace(/\n/g, "<br>")}
          </div>
        </div>
      `;

      chatContainer.insertAdjacentHTML("afterbegin", welcomeHTML);
      chatContainer.scrollTop = 0;
    };

    const forceSameTab = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      const style = doc.createElement("style");
      style.textContent = `a, a * { target: _self !important; cursor: pointer !important; }`;
      doc.head.appendChild(style);

      const chat = doc.querySelector('[data-testid="chatkit-conversation"]') || doc.querySelector('.chatkit-conversation') || doc.body;
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

      injectWelcome(doc);
    };

    iframe.onload = forceSameTab;
    const observer = new ResizeObserver(forceSameTab);
    observer.observe(iframe);

    const poll = setInterval(() => {
      if (iframe.contentDocument?.readyState === 'complete') forceSameTab();
    }, 100);

    setTimeout(() => clearInterval(poll), 10000);

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
