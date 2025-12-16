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
    <main className="flex min-h-screen flex-col items-center justify-end bg-[#1B202C] text-slate-100">
      <div className="chat-container mx-auto w-full px-4 lg:px-6 xl:px-8">
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
