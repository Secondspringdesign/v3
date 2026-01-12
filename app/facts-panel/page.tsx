"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const fetchFacts = async (token: string | null) => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/facts", { headers });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to fetch facts");
        setFacts(json.facts ?? []);
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "outseta-token" && typeof data.token === "string") {
        fetchFacts(data.token);
      }
    };

    window.addEventListener("message", handleMessage);
    fetchFacts(null);

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <main style={{ padding: "1rem", fontFamily: "Inter, sans-serif", color: "#111", background: "#f7f7f7", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Context Panel</h1>
      {error && <div style={{ color: "red", marginBottom: "0.5rem" }}>Error: {error}</div>}
      {facts.length === 0 && <div>No facts yet.</div>}
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
