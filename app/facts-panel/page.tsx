"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type PlannerItem = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_period: "today" | "this_week" | "next_week";
  pillar_id: string | null;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  time_horizon: "this_week" | "this_month" | "this_quarter";
  pillar_id: string | null;
  status: "active" | "achieved" | "archived";
  achieved_at: string | null;
  sort_order: number;
  source_workflow: string | null;
  created_at: string;
  updated_at: string;
};

type Fact = {
  id: string;
  fact_id: string;
  fact_text: string;
  source_workflow?: string | null;
  updated_at?: string | null;
};

type Document = {
  id: string;
  document_type: string;
  title: string | null;
  content: Record<string, unknown> | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type SectionState = { open: boolean };

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, key };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function computeDuePeriod(dateStr: string | null): "today" | "this_week" | "next_week" {
  if (!dateStr) return "today";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays <= 0) return "today";
  if (diffDays <= 6) return "this_week";
  if (diffDays <= 13) return "next_week";
  return "next_week";
}

function categorizeFact(fact: Fact): "business" | "offer" | "marketing" | "money" | "custom" {
  const id = fact.fact_id?.toLowerCase() ?? "";
  if (id.startsWith("business_")) return "business";
  if (id.startsWith("offer_")) return "offer";
  if (id.startsWith("marketing_")) return "marketing";
  if (id.startsWith("money_")) return "money";
  return "custom";
}

export default function BusinessHubPanel() {
  const [outsetaToken, setOutsetaToken] = useState<string | null>(null);
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  const [planner, setPlanner] = useState<PlannerItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [activeTab, setActiveTab] = useState<"facts" | "files">("facts");

  const reconnectingRef = useRef(false);
  const exchangeAttemptsRef = useRef(0);

  const [sections, setSections] = useState<Record<string, SectionState>>({
    planner: { open: true },
    goals: { open: true },
    facts: { open: true },
    files: { open: true },
  });

  const toggleSection = (key: string) => {
    setSections((prev) => ({ ...prev, [key]: { open: !prev[key].open } }));
  };

  const requestTokenFromParent = () => {
    window.parent?.postMessage({ type: "request-token" }, "*");
  };

  // Initial: listen for outseta token; baseline facts fetch without token
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
        setOutsetaToken(data.token);
        setStatus("auth token received");
      }
    };

    const onFocus = () => requestTokenFromParent();
    const onVisibility = () => {
      if (document.visibilityState === "visible") requestTokenFromParent();
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    if (urlToken) {
      setOutsetaToken(urlToken);
      setStatus("auth token (url) received");
    } else {
      requestTokenFromParent();
      fetch("/api/facts")
        .then((r) => r.json())
        .then((json) => {
          setFacts(json.facts ?? []);
          setError(null);
          setStatus("ok (no-token)");
        })
        .catch((e) => {
          setError(String(e));
          setStatus("error (no-token)");
          setPanelError(
            "Business data is temporarily unavailable. Our team is working diligently to resolve the issue as quickly as possible.",
          );
        });
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Exchange Outseta -> Supabase
  useEffect(() => {
    if (!outsetaToken) return;

    const exchangeToken = async () => {
      try {
        setStatus("exchanging");
        const res = await fetch("/api/auth/supabase-exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${outsetaToken}`,
          },
        });
        const json = await res.json();
        if (!res.ok || !json?.access_token) {
          throw new Error(json?.error || `Exchange failed (status ${res.status})`);
        }
        exchangeAttemptsRef.current = 0;
        setSupabaseToken(json.access_token);
        setStatus("exchanged (token)");
        setError(null);
      } catch (e) {
        exchangeAttemptsRef.current += 1;
        setError(String(e));
        setStatus("exchange error; retrying");
        requestTokenFromParent();
        if (exchangeAttemptsRef.current <= 2) {
          await sleep(400);
          exchangeToken();
        }
      }
    };

    exchangeToken();
  }, [outsetaToken]);

  // Supabase connection + realtime
  useEffect(() => {
    if (!supabaseToken) return;

    const { url, key } = requireEnv();
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    let cancelled = false;

    const fetchWithToken = async () => {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseToken}`,
      };

      const fetchDocs = async () => {
        const res = await fetch("/api/documents", { headers });
        if (res.status === 401) throw new Error("unauthorized");
        if (!res.ok) return { documents: [] }; // swallow non-OK -> empty
        return res.json();
      };

      const responses = await Promise.all([
        fetch("/api/planner", { headers }),
        fetch("/api/goals", { headers }),
        fetch("/api/facts", { headers }),
        fetchDocs(),
      ]);

      const [plannerRes, goalsRes, factsRes] = responses as [Response, Response, Response, unknown];

      const any5xx =
        plannerRes.status >= 500 || goalsRes.status >= 500 || factsRes.status >= 500 || false;

      if (plannerRes.status === 401 || goalsRes.status === 401 || factsRes.status === 401) {
        throw new Error("unauthorized");
      }

      const [plannerJson, goalsJson, factsJson, docsJson] = await Promise.all([
        (responses[0] as Response).json(),
        (responses[1] as Response).json(),
        (responses[2] as Response).json(),
        responses[3],
      ]);

      if (!cancelled) {
        setPlanner(plannerJson.planner ?? []);
        setGoals(goalsJson.goals ?? []);
        setFacts(factsJson.facts ?? []);
        setDocuments((docsJson as { documents?: Document[] }).documents ?? []);
        setStatus("ok (token)");
        setError(null);
        setPanelError(
          any5xx
            ? "Business data is temporarily unavailable. Our team is working diligently to resolve the issue as quickly as possible."
            : null,
        );
      }
    };

    const connect = async () => {
      await supabase.auth.setSession({ access_token: supabaseToken, refresh_token: "" });
      supabase.realtime.setAuth(supabaseToken);
      supabase.realtime.connect();
      await fetchWithToken().catch((e) => {
        if (String(e).includes("unauthorized")) requestTokenFromParent();
        else {
          setError(String(e));
          setPanelError(
            "Business data is temporarily unavailable. Our team is working diligently to resolve the issue as quickly as possible.",
          );
        }
      });

      const subscribeTable = (table: string, onChange: () => void) => {
        return supabase
          .channel(`${table}-realtime`)
          .on("postgres_changes", { event: "*", schema: "public", table }, () => {
            onChange();
          })
          .subscribe((st) => {
            if (st === "CLOSED" || st === "TIMED_OUT" || st === "CHANNEL_ERROR") {
              reauthAndReconnect();
            }
          });
      };

      const reauthAndReconnect = async () => {
        if (reconnectingRef.current) return;
        reconnectingRef.current = true;
        try {
          requestTokenFromParent();
          await sleep(400);
          fetchWithToken().catch((e) => {
            setError(String(e));
            setPanelError(
              "Business data is temporarily unavailable. Our team is working diligently to resolve the issue as quickly as possible.",
            );
          });
        } finally {
          reconnectingRef.current = false;
        }
      };

      const channelPlanner = subscribeTable("planner", () => fetchWithToken().catch((e) => setError(String(e))));
      const channelGoals = subscribeTable("goals", () => fetchWithToken().catch((e) => setError(String(e))));
      const channelFacts = subscribeTable("facts", () => fetchWithToken().catch((e) => setError(String(e))));
      const channelDocs = subscribeTable("documents", () => fetchWithToken().catch((e) => setError(String(e))));

      return () => {
        supabase.removeChannel(channelPlanner);
        supabase.removeChannel(channelGoals);
        supabase.removeChannel(channelFacts);
        supabase.removeChannel(channelDocs);
        supabase.realtime.disconnect();
      };
    };

    let cleanup: (() => void) | undefined;
    connect().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [supabaseToken]);

  const addPlannerTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    if (!supabaseToken) {
      setError("Missing Supabase token; request auth again.");
      requestTokenFromParent();
      return;
    }
    const due_period = computeDuePeriod(newTaskDueDate || null);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseToken}`,
    };
    const res = await fetch("/api/planner", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        due_period,
        due_date: newTaskDueDate || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Failed to create task");
      return;
    }
    setPlanner((prev) => [json.planner, ...prev]);
    setNewTaskTitle("");
    setNewTaskDueDate("");
  };

  const togglePlannerTask = async (item: PlannerItem) => {
    if (!supabaseToken) {
      setError("Missing Supabase token; request auth again.");
      requestTokenFromParent();
      return;
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseToken}`,
    };
    const res = await fetch("/api/planner", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: item.id, completed: !item.completed }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Failed to update task");
      return;
    }
    setPlanner((prev) => prev.map((p) => (p.id === item.id ? json.planner : p)));
  };

  const pendingPlanner = planner.filter((p) => !p.completed);
  const completedPlanner = planner.filter((p) => p.completed);

  const groupedPlanner = {
    today: pendingPlanner.filter((p) => p.due_period === "today"),
    this_week: pendingPlanner.filter((p) => p.due_period === "this_week"),
    next_week: pendingPlanner.filter((p) => p.due_period === "next_week"),
  };

  const groupedGoals = {
    this_week: goals.filter((g) => g.time_horizon === "this_week"),
    this_month: goals.filter((g) => g.time_horizon === "this_month"),
    this_quarter: goals.filter((g) => g.time_horizon === "this_quarter"),
  };

  const factCategories = ["business", "offer", "marketing", "money", "custom"] as const;
  const factsByCategory = factCategories.reduce<Record<string, Fact[]>>((acc, cat) => {
    acc[cat] = [];
    return acc;
  }, {});
  for (const f of facts) {
    factsByCategory[categorizeFact(f)].push(f);
  }

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
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Business Hub</h1>
      <div style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
        Status: {status} {error ? `• Error: ${error}` : ""}
      </div>

      {panelError && (
        <div
          style={{
            background: "#fff4e5",
            color: "#8a4b00",
            border: "1px solid #f3d19c",
            borderRadius: 8,
            padding: "0.75rem",
            marginBottom: "0.75rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          Business data is temporarily unavailable. Our team is working diligently to resolve the issue as quickly as
          possible.
        </div>
      )}

      {/* Planner */}
      <Section title="Planner" open={sections.planner.open} onToggle={() => toggleSection("planner")}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <input
            placeholder="Add a task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            style={{ flex: "1 1 180px", padding: "0.5rem" }}
          />
          <input
            type="date"
            value={newTaskDueDate}
            onChange={(e) => setNewTaskDueDate(e.target.value)}
            style={{ padding: "0.5rem" }}
          />
          <button onClick={addPlannerTask} style={{ padding: "0.5rem 0.75rem" }}>
            Add
          </button>
        </div>

        {["today", "this_week", "next_week"].map((bucket) => (
          <div key={bucket} style={{ marginBottom: "0.5rem" }}>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
              {bucket === "today" ? "Today" : bucket === "this_week" ? "This Week" : "Next Week"}
            </div>
            {groupedPlanner[bucket as keyof typeof groupedPlanner].length === 0 && (
              <div style={{ color: "#777", fontSize: "0.9rem" }}>No tasks</div>
            )}
            {groupedPlanner[bucket as keyof typeof groupedPlanner].map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  background: "#fff",
                  borderRadius: 8,
                  marginBottom: 4,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                <input type="checkbox" checked={item.completed} onChange={() => togglePlannerTask(item)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, textDecoration: item.completed ? "line-through" : "none" }}>
                    {item.title}
                  </div>
                  <div style={{ color: "#666", fontSize: "0.9rem" }}>
                    {item.due_date ? `Due: ${item.due_date}` : ""}
                  </div>
                  {item.description && (
                    <div style={{ color: "#666", fontSize: "0.9rem" }}>{item.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: "0.75rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Completed</div>
          {completedPlanner.length === 0 && <div style={{ color: "#777", fontSize: "0.9rem" }}>No completed tasks</div>}
          {completedPlanner.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem",
                background: "#f3f3f3",
                borderRadius: 8,
                marginBottom: 4,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              <input type="checkbox" checked onChange={() => togglePlannerTask(item)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, textDecoration: "line-through" }}>{item.title}</div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>
                  {item.due_date ? `Due: ${item.due_date}` : ""}
                  {item.completed_at ? ` • completed: ${new Date(item.completed_at).toLocaleString()}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Goals */}
      <Section title="Goals" open={sections.goals.open} onToggle={() => toggleSection("goals")}>
        {(["this_week", "this_month", "this_quarter"] as const).map((bucket) => (
          <div key={bucket} style={{ marginBottom: "0.5rem" }}>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
              {bucket === "this_week" ? "This Week" : bucket === "this_month" ? "This Month" : "This Quarter"}
            </div>
            {groupedGoals[bucket].length === 0 && (
              <div style={{ color: "#777", fontSize: "0.9rem" }}>No goals</div>
            )}
            {groupedGoals[bucket].map((g) => (
              <div
                key={g.id}
                style={{
                  padding: "0.6rem",
                  background: "#fff",
                  borderRadius: 8,
                  marginBottom: 4,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                <div style={{ fontWeight: 600 }}>{g.title}</div>
                {g.description && (
                  <div style={{ color: "#666", fontSize: "0.9rem", marginTop: 4 }}>{g.description}</div>
                )}
                <div style={{ color: "#888", fontSize: "0.85rem", marginTop: 4 }}>
                  Status: {g.status}
                  {g.achieved_at ? ` • achieved ${new Date(g.achieved_at).toLocaleDateString()}` : ""}
                </div>
              </div>
            ))}
          </div>
        ))}
      </Section>

      {/* Tabs for Facts / Files */}
      <div style={{ marginTop: "0.5rem", borderTop: "1px solid #e5e5e5", paddingTop: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <button
            onClick={() => setActiveTab("facts")}
            style={{
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "facts" ? "2px solid #2563eb" : "2px solid transparent",
              color: activeTab === "facts" ? "#111" : "#666",
              paddingBottom: "0.25rem",
              fontWeight: activeTab === "facts" ? 700 : 600,
              cursor: "pointer",
            }}
          >
            Facts
          </button>
          <button
            onClick={() => setActiveTab("files")}
            style={{
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "files" ? "2px solid #2563eb" : "2px solid transparent",
              color: activeTab === "files" ? "#111" : "#666",
              paddingBottom: "0.25rem",
              fontWeight: activeTab === "files" ? 700 : 600,
              cursor: "pointer",
            }}
          >
            Files
          </button>
        </div>

        {activeTab === "facts" ? (
          <Section title="Facts" open={sections.facts.open} onToggle={() => toggleSection("facts")}>
            {facts.length === 0 && <div style={{ color: "#777" }}>No facts yet.</div>}
            {factCategories.map((cat) => (
              <div key={cat} style={{ marginBottom: "0.5rem" }}>
                <div style={{ fontWeight: 700, marginBottom: "0.25rem", textTransform: "capitalize" }}>
                  {cat}
                </div>
                {factsByCategory[cat].length === 0 ? (
                  <div style={{ color: "#777", fontSize: "0.9rem" }}>No facts</div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {factsByCategory[cat].map((f) => (
                      <li
                        key={f.id}
                        style={{
                          marginBottom: "0.6rem",
                          padding: "0.65rem",
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
                )}
              </div>
            ))}
          </Section>
        ) : (
          <Section title="Files" open={sections.files.open} onToggle={() => toggleSection("files")}>
            {documents.length === 0 && <div style={{ color: "#777" }}>No files yet.</div>}
            {documents.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: "0.6rem",
                  background: "#fff",
                  borderRadius: 8,
                  marginBottom: 6,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                <div style={{ fontWeight: 600 }}>{d.title || d.document_type}</div>
                <div style={{ color: "#666", fontSize: "0.9rem", marginTop: 4 }}>Type: {d.document_type}</div>
                <div style={{ color: "#888", fontSize: "0.85rem", marginTop: 4 }}>
                  Updated: {new Date(d.updated_at).toLocaleString()}
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>
    </main>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
          fontWeight: 700,
          marginBottom: open ? "0.35rem" : 0,
        }}
        onClick={onToggle}
      >
        <span style={{ marginRight: 8 }}>{open ? "▼" : "▶"}</span>
        {title}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
