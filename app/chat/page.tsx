// app/chat/page.tsx
"use client";

import { ChatKitPanel } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCallback } from "react";

export default function ChatPage() {
  const { scheme, setScheme } = useColorScheme();

  const handleWidgetAction = useCallback(async () => {}, []);
  const handleResponseEnd = useCallback(() => {}, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-end bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto w-full p-4">
        {/* REMOVED max-w-5xl */}
        <ChatKitPanel
          theme={scheme}
          onWidgetAction={handleWidgetAction}
          onResponseEnd={handleResponseEnd}
          onThemeRequest={setScheme}
        />
      </div>

      {/* FULL WIDTH OVERRIDE */}
      <style jsx global>{`
        openai-chatkit,
        [data-chatkit-conversation],
        .chatkit-conversation,
        .chatkit-messages,
        .chatkit-message-list {
          max-width: none !important;
          width: 100% !important;
          margin: 0 auto !important;
        }
        /* Force input to full width */
        [data-testid="chatkit-input"] {
          width: 100% !important;
          max-width: none !important;
        }
      `}</style>
    </main>
  );
}
