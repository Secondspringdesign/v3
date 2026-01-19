"use client";

import { useEffect, useState } from "react";
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

export default function FactsPanel() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string>("idle");
  const [outsetaToken, setOutsetaToken] = useState<string | null>(null);
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchFacts = async (token: string | null, label: string) => {
      try {
        setLastStatus(`fetching (${label})`);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/facts", { headers });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Failed to fetch facts (status ${res.status})`);
        setFacts(json.facts ?? []);
        setError(null);
        setLastStatus(`ok (${label})`);
      } catch (e) {
        setError(String(e));
        setLastStatus(`error (${label})`);
      }
    };

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
      }
    };

    window.addEventListener("message", handleMessage);

    if (urlToken) {
      console.log("[facts-panel] using outseta_token from URL param; length:", urlToken.length);
      setOutsetaToken(urlToken);
    } else {
      fetchFacts(null, "no-token");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!outsetaToken) return;

    const exchangeToken = async () => {
      try {
        setLastStatus("exchanging");
        const res = await fetch("/api/auth/supabase-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: outsetaToken }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Exchange failed (status ${res.status})`);
        if (!json?.access_token) throw new Error("Exchange missing access_token");
        setSupabaseToken(json.access_token);
        setLastStatus("exchanged");
      } catch (e) {
        setError(String(e));
        setLastStatus("exchange error");
      }
    };

    exchangeToken();
  }, [outsetaToken]);

  useEffect(() => {
    if (!supabaseToken) return;

    let cancelled = false;
    const { url, key } = requireEnv();

    const init = async () => {
      // Fresh client per token
      const supabase = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });

      // Set a session so supabase-js uses this JWT for realtime (and any RPC/fetch if we wanted)
      await supabase.auth.setSession({
        access_token: supabaseToken,
        refresh_token: "",
      });

      supabase.realtime.setAuth(supabaseToken);
      supabase.realtime.connect();

      console.log("[facts-panel] setAuth token snippet", supabaseToken.slice(0, 12));

      const fetchWithToken = () =>
        fetch("/api/facts", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseToken}`,
          },
        })
          .then((res) => res.json())
          .then((json) => {
            if (!cancelled) setFacts(json.facts ?? []);
          })
          .catch((e) => {
            if (!cancelled) setError(String(e));
          });

      // Initial load with Supabase JWT
      await fetchWithToken();

      const channel = supabase
        .channel("facts-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "facts" }, fetchWithToken)
        .subscribe((status) => {
          console.log("[facts-panel] realtime status:", status);
        });

      return () => {
        supabase.removeChannel(channel);
        supabase.realtime.disconnect();
      };
    };

    let cleanup: (() => void) | undefined;
    init().then((fn) => {
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
      <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>Status: {lastStatus}</div>
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
