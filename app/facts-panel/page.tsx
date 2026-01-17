"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Fact = {
  id: string;
  fact_id: string;
  fact_text: string;
  source_workflow?: string | null;
  updated_at?: string | null;
};

export default function FactsPanel() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string>("idle");
  const [outsetaToken, setOutsetaToken] = useState<string | null>(null);

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
        fetchFacts(data.token, "postMessage");
      }
    };

    window.addEventListener("message", handleMessage);

    if (urlToken) {
      console.log("[facts-panel] using outseta_token from URL param; length:", urlToken.length);
      setOutsetaToken(urlToken);
      fetchFacts(urlToken, "url-param");
    } else {
      fetchFacts(null, "no-token");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!outsetaToken) return;

    const supabase = getSupabaseBrowserClient();

    // Attach Outseta JWT to Realtime so RLS can filter by business_id
    supabase.realtime.setAuth(outsetaToken);

    const channel = supabase
      .channel("facts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "facts" },
        () => {
          // Re-fetch with same auth when facts change
          fetch("/api/facts", {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${outsetaToken}`,
            },
          })
            .then((res) => res.json())
            .then((json) => setFacts(json.facts ?? []))
            .catch((e) => setError(String(e)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [outsetaToken]);

  return (
    <main style={{ padding: "1rem", fontFamily: "Inter, sans-serif", color: "#111", background: "#f7f7f7", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Context Panel</h1>
      {error && <div style={{ color: "red", marginBottom: "0.5rem" }}>Error: {error}</div>}
      <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>Status: {lastStatus}</div>
      {facts.length === 0 && !error && <div>No facts yet.</div>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {facts.map((f) => (
          <li key={f.id} style={{ marginBottom: "0.75rem", padding: "0.75rem", background: "#fff", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
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
