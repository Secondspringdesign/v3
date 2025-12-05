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
      <div className="w-full min-w-[600px] p-4">
        <div className="space-y-2">
          <ChatKitPanel
            theme={scheme}
            onWidgetAction={handleWidgetAction}
            onResponseEnd={handleResponseEnd}
            onThemeRequest={setScheme}
          />
        </div>
      </div>
    </main>
  );
}
