"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

type Fact = {
  id: string;
  fact_id: string;
  fact_text: string;
  source_workflow?: string | null;
  updated_at?: string | null;
};

function requireEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
  return { url, key };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function FactsPanel() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string>("idle");
  const [outsetaToken, setOutsetaToken] = useState<string | null>(null);
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null);
  const reconnectingRef = useRef(false);
  const exchangeAttemptsRef = useRef(0);

  // --- utils ---
  const requestTokenFromParent = () => {
    window.parent?.postMessage({ type: "request-token" }, "*");
  };

  // --- first effect: get outseta token, base fetch without token ---
  useEffect(() => {
    const urlToken = (() => {
      try {
        const u = new URL(window.location.href);
        return u.searchParams.get("outseta_token");
      } catch {
        return null;
      }
    })();

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "outseta-token" && typeof data.token === "string") {
        console.log("[facts-panel] received outseta-token via postMessage; length:", data.token.length);
        setOutsetaToken(data.token);
        setLastStatus("auth token received");
      }
    };

    const onFocus = () => {
      requestTokenFromParent();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        requestTokenFromParent();
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    if (urlToken) {
      console.log("[facts-panel] using outseta_token from URL param; length:", urlToken.length);
      setOutsetaToken(urlToken);
      setLastStatus("auth token (url) received");
    } else {
      requestTokenFromParent();
      fetch("/api/facts")
        .then((r) => r.json())
        .then((json) => {
          setFacts(json.facts ?? []);
          setError(null);
          setLastStatus("ok (no-token)");
        })
        .catch((e) => {
          setError(String(e));
          setLastStatus("error (no-token)");
        });
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // --- exchange outseta -> supabase (with retry + correct header) ---
  useEffect(() => {
    if (!outsetaToken) return;

    const exchangeToken = async () => {
      try {
        setLastStatus("exchanging");
        const res = await fetch("/api/auth/supabase-exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${outsetaToken}`, // ✅ REQUIRED
          },
        });
        const json = await res.json();
        if (!res.ok || !json?.access_token) {
          throw new Error(json?.error || `Exchange failed (status ${res.status})`);
        }
        exchangeAttemptsRef.current = 0;
        setSupabaseToken(json.access_token);
        setLastStatus("exchanged (token)");
        setError(null);
      } catch (e) {
        exchangeAttemptsRef.current += 1;
        setError(String(e));
        setLastStatus("exchange error; retrying");
        requestTokenFromParent();

        // retry once with short backoff
        if (exchangeAttemptsRef.current <= 2) {
          await sleep(400);
          exchangeToken();
        }
      }
    };

    exchangeToken();
  }, [outsetaToken]);

  // --- supabase connection + realtime + retry ---
  useEffect(() => {
    if (!supabaseToken) return;

    let cancelled = false;
    const { url, key } = requireEnv();

    const connect = async (token: string) => {
      const supabase = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });

      await supabase.auth.setSession({ access_token: token, refresh_token: "" });
      supabase.realtime.setAuth(token);
      supabase.realtime.connect();

      console.log("[facts-panel] setAuth token snippet", token.slice(0, 12));

      const fetchWithToken = () =>
        fetch("/api/facts", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
          .then(async (res) => {
            if (res.status === 401) throw new Error("unauthorized");
            const json = await res.json();
            if (!cancelled) {
              setFacts(json.facts ?? []);
              setLastStatus("ok (token)");
              setError(null);
            }
          })
          .catch((e) => {
            if (!cancelled) setError(String(e));
            throw e;
          });

      // Initial load
      fetchWithToken().catch((e) => {
        if (String(e).includes("unauthorized")) {
          requestTokenFromParent();
        }
      });

      let channel = supabase.channel("facts-realtime");

      const subscribe = () => {
        channel = supabase
          .channel("facts-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "facts" }, () => {
            fetchWithToken().catch((e) => {
              if (String(e).includes("unauthorized")) reauthAndReconnect();
            });
          })
          .subscribe((status) => {
            console.log("[facts-panel] realtime status:", status);
            if (status === "CLOSED" || status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
              reauthAndReconnect();
            }
          });
      };

      const reauthAndReconnect = async () => {
        if (reconnectingRef.current) return;
        reconnectingRef.current = true;
        try {
          // re-request token, then resubscribe after short delay
          requestTokenFromParent();
          await sleep(400);
          supabase.removeChannel(channel);
          subscribe();
        } finally {
          reconnectingRef.current = false;
        }
      };

      subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.realtime.disconnect();
      };
    };

    let cleanup: (() => void) | undefined;
    connect(supabaseToken).then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [supabaseToken]);

  return (
    <main
      style={{
        padding: "1rem",
        fontFamily: "Inter, sans-serif",
        color: "#111",
        background: "#f7f7f7",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Context Panel</h1>
      {error && <div style={{ color: "red", marginBottom: "0.5rem" }}>Error: {error}</div>}
      <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
        Status: {lastStatus}
      </div>
      {facts.length === 0 && !error && <div>No facts yet.</div>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {facts.map((f) => (
          <li
            key={f.id}
            style={{
              marginBottom: "0.75rem",
              padding: "0.75rem",
              background: "#fff",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontWeight: 600 }}>{f.fact_id}</div>
            <div style={{ marginTop: "0.25rem" }}>{f.fact_text}</div>
            <div style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: "#666" }}>
              {f.source_workflow ? `source: ${f.source_workflow}` : "source: n/a"}
              {f.updated_at ? ` • updated: ${new Date(f.updated_at).toLocaleString()}` : ""}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
