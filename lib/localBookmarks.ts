// app/lib/localBookmarks.ts
export type LocalBookmark = {
  id: string;
  agent: string;
  title: string;
  snippet?: string | null;
  content?: unknown | null;
  createdAt: string;
};

const KEY = "chat_bookmarks_v1";

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function generateId(): string {
  // Use crypto.randomUUID if available, otherwise fallback to a safe string
  try {
    const maybeCrypto = (globalThis as unknown) as { crypto?: Crypto };
    const c = maybeCrypto.crypto;
    if (c && typeof c.randomUUID === "function") {
      return c.randomUUID();
    }
  } catch {
    // ignore
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listLocalBookmarks(): LocalBookmark[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  const arr = safeParse<LocalBookmark[]>(raw) ?? [];
  // newest first
  return arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function saveLocalBookmark(payload: {
  agent: string;
  title: string;
  snippet?: string | null;
  content?: unknown | null;
}): LocalBookmark {
  const now = new Date().toISOString();
  const id = generateId();
  const bm: LocalBookmark = {
    id,
    agent: payload.agent,
    title: payload.title,
    snippet: payload.snippet ?? null,
    content: payload.content ?? null,
    createdAt: now,
  };
  try {
    const current = listLocalBookmarks();
    current.unshift(bm);
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // ignore errors writing to localStorage
  }
  return bm;
}

export function deleteLocalBookmark(id: string) {
  try {
    const current = listLocalBookmarks().filter((b) => b.id !== id);
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function clearLocalBookmarks() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
