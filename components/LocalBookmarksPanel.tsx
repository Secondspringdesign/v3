// components/LocalBookmarksPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { listLocalBookmarks, deleteLocalBookmark } from "@/lib/localBookmarks";

type Bookmark = {
  id: string;
  agent: string;
  title: string;
  snippet?: string | null;
  content?: unknown | null;
  createdAt?: string;
};

export function LocalBookmarksPanel({ onOpen }: { onOpen?: (b: Bookmark) => void }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);

  function load() {
    setBookmarks(listLocalBookmarks() as Bookmark[]);
  }

  useEffect(() => {
    load();
    // update when other tabs modify storage
    const handler = () => load();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (!bookmarks || bookmarks.length === 0) {
    return <div className="p-2 text-sm">No bookmarks yet.</div>;
  }

  return (
    <div className="p-2 space-y-3" style={{ maxHeight: "60vh", overflowY: "auto" }}>
      {bookmarks.map((b) => (
        <div key={b.id} className="p-3 border rounded shadow-sm flex items-start justify-between bg-white">
          <div className="flex-1 pr-3">
            <div className="text-sm font-semibold">{b.title}</div>
            <div className="text-xs text-slate-500">{b.agent} • {new Date(b.createdAt || "").toLocaleString()}</div>
            {b.snippet && <div className="mt-2 text-sm text-slate-700">{b.snippet}</div>}
          </div>
          <div className="flex flex-col gap-2 items-end">
            <button
              onClick={() => onOpen?.(b)}
              className="text-sm px-2 py-1 bg-sky-600 text-white rounded"
            >
              Open
            </button>
            <button
              onClick={() => {
                deleteLocalBookmark(b.id);
                load();
              }}
              className="text-sm px-2 py-1 border rounded"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
