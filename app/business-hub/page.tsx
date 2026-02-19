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
  fact_value: string;
  source_workflow?: string | null;
  updated_at?: string | null;
  category_name?: string | null;
  fact_type_name?: string | null;
  fact_type_id?: string | null;
  description?: string | null;
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

// Predefined fact slots - all 28 fact types grouped by category
const PREDEFINED_FACT_SLOTS: Record<string, Array<{fact_type_id: string; label: string; description: string}>> = {
  business: [
    { fact_type_id: "business_name", label: "Business Name", description: "The name of the venture" },
    { fact_type_id: "core_problem", label: "Core Problem", description: "The core problem you are solving" },
    { fact_type_id: "vision_statement", label: "Vision Statement", description: "Where you're headed; aspirational future state" },
    { fact_type_id: "target_customer", label: "Target Customer", description: "Who the product or service is for" },
    { fact_type_id: "market_size", label: "Market Size", description: "How big the market/opportunity is" },
    { fact_type_id: "primary_competitors", label: "Primary Competitors", description: "Top competitors or alternatives" },
    { fact_type_id: "founder_background_summary", label: "Founder Background", description: "Relevant founder experience and context" },
  ],
  offer: [
    { fact_type_id: "offer_summary", label: "Offer Summary", description: "Short description of what you sell" },
    { fact_type_id: "core_benefits_outcomes", label: "Core Benefits & Outcomes", description: "Outcomes/benefits the offer delivers" },
    { fact_type_id: "value_proposition", label: "Value Proposition", description: "Why choose this over alternatives" },
    { fact_type_id: "pricing_model", label: "Pricing Model", description: "How the product or service is priced" },
    { fact_type_id: "positioning_statement", label: "Positioning Statement", description: "How you position vs. the market" },
  ],
  marketing: [
    { fact_type_id: "brand_voice", label: "Brand Voice", description: "How the brand sounds when it communicates" },
    { fact_type_id: "brand_tone", label: "Brand Tone", description: "Emotional quality of the brand communication" },
    { fact_type_id: "brand_personality_traits", label: "Brand Personality Traits", description: "Brand character traits" },
    { fact_type_id: "elevator_pitch", label: "Elevator Pitch", description: "One-sentence pitch" },
    { fact_type_id: "primary_channels", label: "Primary Channels", description: "Where you reach/engage customers" },
    { fact_type_id: "growth_loop_hypothesis", label: "Growth Loop Hypothesis", description: "How growth may reinforce itself" },
  ],
  money: [
    { fact_type_id: "startup_costs", label: "Startup Costs", description: "Initial capital required to launch" },
    { fact_type_id: "runway", label: "Runway", description: "Months of runway; burn vs. cash" },
    { fact_type_id: "revenue_streams", label: "Revenue Streams", description: "Sources of income for the business" },
    { fact_type_id: "unit_economics", label: "Unit Economics", description: "Key unit economics (e.g., CAC, LTV, gross margin)" },
  ],
  operations: [
    { fact_type_id: "key_tools_stack", label: "Key Tools Stack", description: "Core software/tools and their primary use" },
    { fact_type_id: "standard_operating_procedures_links", label: "SOP Links", description: "Where SOP docs live / key processes" },
    { fact_type_id: "customer_support_guidelines", label: "Customer Support Guidelines", description: "SLAs, escalation, tone" },
    { fact_type_id: "legal_entity_structure", label: "Legal Entity Structure", description: "LLC/C-Corp/etc., jurisdiction, key contracts" },
    { fact_type_id: "intellectual_property_summary", label: "IP Summary", description: "Trademarks, patents, key domains" },
  ],
};

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, key };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getTodayInTimezone(tz: string): Date {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // returns YYYY-MM-DD
  return new Date(dateStr + 'T00:00:00');
}

function computeDuePeriod(dateStr: string | null, tz: string): "today" | "this_week" | "next_week" {
  if (!dateStr) return "today";
  const today = getTodayInTimezone(tz);

  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays <= 0) return "today";
  if (diffDays <= 6) return "this_week";
  if (diffDays <= 13) return "next_week";
  return "next_week";
}

function dueLabel(dateStr: string | null, tz: string): string {
  if (!dateStr) return "No date";
  const today = getTodayInTimezone(tz);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function bucketHeading(bucket: "today" | "this_week" | "next_week", tz: string) {
  const today = getTodayInTimezone(tz);
  const dayName = today.toLocaleDateString(undefined, { weekday: "long" });
  if (bucket === "today") return `Today (${dayName})`;
  if (bucket === "this_week") return "This Week";
  return "Next Week";
}

/**
 * Check if a timestamp is "today" in the given timezone.
 * Returns true if the timestamp is within today (00:00 - 23:59) in the user's timezone.
 */
function isToday(timestamp: string | null, timezone: string): boolean {
  if (!timestamp) return false;
  
  try {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Format both dates as YYYY-MM-DD in the user's timezone
    const dateStr = date.toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA gives YYYY-MM-DD
    const nowStr = now.toLocaleDateString("en-CA", { timeZone: timezone });
    
    return dateStr === nowStr;
  } catch {
    return false;
  }
}

type InlineDateState = { id: string; value: string };

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
  const [showNewTaskRow, setShowNewTaskRow] = useState(false);
  const [editingDate, setEditingDate] = useState<InlineDateState | null>(null);

  // State for inline fact editing
  const [editingFact, setEditingFact] = useState<{ factTypeId: string; value: string } | null>(null);
  const [savingFact, setSavingFact] = useState(false);

  // State for inline goal editing
  const [editingGoal, setEditingGoal] = useState<{ id: string; title: string; description: string } | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  // Timezone state (will be auto-detected on mount)
  const [userTimezone, setUserTimezone] = useState<string>("UTC");

  const [activeTab, setActiveTab] = useState<"facts" | "files">("facts");

  const reconnectingRef = useRef(false);
  const exchangeAttemptsRef = useRef(0);

  const [sections, setSections] = useState<Record<string, SectionState>>({
    planner: { open: true },
    goals: { open: true },
    facts: { open: true },
    files: { open: true },
  });

  const [plannerBucketsOpen, setPlannerBucketsOpen] = useState<Record<string, boolean>>({
    today: true,
    this_week: false,
    next_week: false,
    completed: false,
  });

  const [goalBucketsOpen, setGoalBucketsOpen] = useState<Record<string, boolean>>({
    this_week: true,
    this_month: true,
    this_quarter: true,
    achieved: false,
  });

  const [factCategoriesOpen, setFactCategoriesOpen] = useState<Record<string, boolean>>({
    business: false,
    offer: false,
    marketing: false,
    money: false,
    operations: false,
    custom: false,
  });

  const toggleSection = (key: string) => {
    setSections((prev) => ({ ...prev, [key]: { open: !prev[key].open } }));
  };

  const togglePlannerBucket = (key: keyof typeof plannerBucketsOpen) => {
    setPlannerBucketsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleGoalBucket = (key: keyof typeof goalBucketsOpen) => {
    setGoalBucketsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFactCategory = (key: keyof typeof factCategoriesOpen) => {
    setFactCategoriesOpen((prev) => ({ ...prev, [key]: !prev[key] }));
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

  // Auto-detect timezone on mount
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setUserTimezone(detected);
    } catch (e) {
      console.error("Failed to detect timezone:", e);
      setUserTimezone("UTC");
    }
  }, []);

  // Save timezone as a fact when it changes (and we have a token)
  useEffect(() => {
    if (!outsetaToken || !userTimezone) return;
    
    // Check if timezone fact already matches
    const timezoneFact = facts.find((f) => f.fact_type_id === "user_timezone" || f.fact_id === "user_timezone");
    if (timezoneFact && timezoneFact.fact_value === userTimezone) return;
    
    // Save the timezone fact
    const saveTimezone = async () => {
      try {
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${outsetaToken}`,
        };
        
        const res = await fetch("/api/facts", {
          method: "POST",
          headers,
          body: JSON.stringify({
            fact_id: "user_timezone",
            fact_value: userTimezone,
            fact_type_id: "user_timezone",
          }),
        });
        
        if (res.ok) {
          const json = await res.json();
          setFacts((prev) => {
            const existing = prev.find((f) => f.fact_type_id === "user_timezone" || f.fact_id === "user_timezone");
            if (existing) {
              return prev.map((f) => 
                (f.fact_type_id === "user_timezone" || f.fact_id === "user_timezone") ? json.fact : f
              );
            } else {
              return [...prev, json.fact];
            }
          });
        }
      } catch (e) {
        console.error("Failed to save timezone fact:", e);
      }
    };
    
    saveTimezone();
  }, [userTimezone, outsetaToken, facts]);

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
    const due_period = computeDuePeriod(newTaskDueDate || null, userTimezone);
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
      setError(json?.error || "Failed to create calendar event");
      return;
    }
    setPlanner((prev) => [json.planner, ...prev]);
    setNewTaskTitle("");
    setNewTaskDueDate("");
    setShowNewTaskRow(false);
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
      setError(json?.error || "Failed to update calendar event");
      return;
    }
    setPlanner((prev) => prev.map((p) => (p.id === item.id ? json.planner : p)));
  };

  const updateDueDate = async (item: PlannerItem, newDate: string) => {
    if (!supabaseToken) {
      setError("Missing Supabase token; request auth again.");
      requestTokenFromParent();
      return;
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseToken}`,
    };
    const due_period = computeDuePeriod(newDate || null, userTimezone);
    const res = await fetch("/api/planner", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: item.id, due_date: newDate || null, due_period }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Failed to update date");
      return;
    }
    setPlanner((prev) => prev.map((p) => (p.id === item.id ? json.planner : p)));
    setEditingDate(null);
  };

  // Handler for saving a fact (create or update)
  const saveFact = async (factTypeId: string, factValue: string, existingFactId?: string) => {
    if (!outsetaToken) {
      setError("Missing auth token; request auth again.");
      requestTokenFromParent();
      return;
    }
    
    setSavingFact(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${outsetaToken}`,
      };
      
      const body = {
        fact_id: existingFactId || factTypeId,
        fact_value: factValue.trim(),
        fact_type_id: factTypeId,
      };
      
      const res = await fetch("/api/facts", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to save fact");
        return;
      }
      
      // Update local state
      setFacts((prev) => {
        const existing = prev.find((f) => f.fact_type_id === factTypeId || f.fact_id === factTypeId);
        if (existing) {
          return prev.map((f) => 
            (f.fact_type_id === factTypeId || f.fact_id === factTypeId) ? json.fact : f
          );
        } else {
          return [...prev, json.fact];
        }
      });
      
      setEditingFact(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingFact(false);
    }
  };

  // Handler for saving a goal (update)
  const saveGoal = async (goalId: string, title: string, description: string) => {
    if (!outsetaToken) {
      setError("Missing auth token; request auth again.");
      requestTokenFromParent();
      return;
    }
    
    setSavingGoal(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${outsetaToken}`,
      };
      
      const body = {
        id: goalId,
        title: title.trim(),
        description: description.trim() || null,
      };
      
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to save goal");
        return;
      }
      
      // Update local state
      setGoals((prev) => prev.map((g) => (g.id === goalId ? json.goal : g)));
      setEditingGoal(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingGoal(false);
    }
  };

  // Handler for marking a goal as achieved
  const markGoalAsAchieved = async (goalId: string) => {
    if (!outsetaToken) {
      setError("Missing auth token; request auth again.");
      requestTokenFromParent();
      return;
    }
    
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${outsetaToken}`,
      };
      
      const body = {
        id: goalId,
        status: "achieved",
      };
      
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to mark goal as achieved");
        return;
      }
      
      // Update local state
      setGoals((prev) => prev.map((g) => (g.id === goalId ? json.goal : g)));
    } catch (e) {
      setError(String(e));
    }
  };

  const pendingPlanner = planner.filter((p) => !p.completed);
  const recentlyCompleted = planner.filter((p) => p.completed && isToday(p.completed_at, userTimezone));
  const completedPlanner = planner.filter((p) => p.completed && !isToday(p.completed_at, userTimezone));

  const groupedPlanner = {
    today: [
      ...pendingPlanner.filter((p) => p.due_period === "today"),
      ...recentlyCompleted.filter((p) => p.due_period === "today"),
    ],
    this_week: [
      ...pendingPlanner.filter((p) => p.due_period === "this_week"),
      ...recentlyCompleted.filter((p) => p.due_period === "this_week"),
    ],
    next_week: [
      ...pendingPlanner.filter((p) => p.due_period === "next_week"),
      ...recentlyCompleted.filter((p) => p.due_period === "next_week"),
    ],
  };

  const activeGoals = goals.filter((g) => g.status === "active");
  const achievedGoals = goals.filter((g) => g.status === "achieved");

  const groupedGoals = {
    this_week: activeGoals.filter((g) => g.time_horizon === "this_week"),
    this_month: activeGoals.filter((g) => g.time_horizon === "this_month"),
    this_quarter: activeGoals.filter((g) => g.time_horizon === "this_quarter"),
  };

  // Group facts — currently by ID prefix; can switch to category_name when API provides it.
  const factCategories = ["business", "offer", "marketing", "money", "operations", "custom"] as const;
  const factsByCategory = factCategories.reduce<Record<string, Fact[]>>((acc, cat) => {
    acc[cat] = [];
    return acc;
  }, {});
  for (const f of facts) {
    if (f.category_name) {
      const key = f.category_name.toLowerCase();
      if (key === "business") factsByCategory.business.push(f);
      else if (key === "offer") factsByCategory.offer.push(f);
      else if (key === "marketing") factsByCategory.marketing.push(f);
      else if (key === "money") factsByCategory.money.push(f);
      else if (key === "operations") factsByCategory.operations.push(f);
      else factsByCategory.custom.push(f);
    } else {
      const id = f.fact_id?.toLowerCase() ?? "";
      if (id.startsWith("business_")) factsByCategory.business.push(f);
      else if (id.startsWith("offer_")) factsByCategory.offer.push(f);
      else if (id.startsWith("marketing_")) factsByCategory.marketing.push(f);
      else if (id.startsWith("money_")) factsByCategory.money.push(f);
      else if (id.startsWith("key_tools_") || id.startsWith("standard_operating_") || id.startsWith("customer_support_") || id.startsWith("legal_entity_") || id.startsWith("intellectual_property_")) factsByCategory.operations.push(f);
      else factsByCategory.custom.push(f);
    }
  }

  const renderPlannerBucket = (bucketKey: "today" | "this_week" | "next_week") => {
    const items = groupedPlanner[bucketKey];
    const open = plannerBucketsOpen[bucketKey];
    const isToday = bucketKey === "today";
    return (
      <div style={{ marginBottom: "0.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontWeight: 700,
            cursor: "pointer",
            userSelect: "none",
            padding: "0.35rem 0",
          }}
          onClick={() => togglePlannerBucket(bucketKey)}
        >
          <span style={{ fontSize: "1rem" }}>{open ? "▾" : "▸"}</span>
          <span style={{ flex: 1 }}>{bucketHeading(bucketKey, userTimezone)}</span>
          {isToday && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNewTaskRow((s) => !s);
              }}
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 16,
                padding: "0.25rem 0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              + Add
            </button>
          )}
        </div>
        {isToday && showNewTaskRow && (
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginBottom: "0.75rem",
              flexWrap: "wrap",
              alignItems: "center",
              paddingLeft: "1.5rem",
            }}
          >
            <input
              placeholder="Add a calendar event..."
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
            <button
              onClick={() => {
                setShowNewTaskRow(false);
                setNewTaskTitle("");
                setNewTaskDueDate("");
              }}
              style={{ padding: "0.5rem 0.75rem", background: "#f3f3f3", border: "1px solid #ddd" }}
            >
              Cancel
            </button>
          </div>
        )}
        {open && (
          <div>
            {items.length === 0 && <div style={{ color: "#777", fontSize: "0.9rem" }}>No calendar events</div>}
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem",
                  background: "#fff",
                  borderRadius: 10,
                  marginBottom: 6,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                <input type="checkbox" checked={item.completed} onChange={() => togglePlannerTask(item)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      textDecoration: item.completed ? "line-through" : "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </div>
                </div>
                <div style={{ fontSize: "0.9rem", color: "#555", minWidth: 110, textAlign: "right" }}>
                  {editingDate?.id === item.id ? (
                    <input
                      type="date"
                      value={editingDate.value}
                      onChange={(e) => setEditingDate({ id: item.id, value: e.target.value })}
                      onBlur={() => updateDueDate(item, editingDate.value)}
                      style={{ padding: "0.25rem", fontSize: "0.9rem" }}
                      autoFocus
                    />
                  ) : (
                    <span
                      style={{ cursor: "pointer", textDecoration: "underline dotted" }}
                      onClick={() =>
                        setEditingDate({
                          id: item.id,
                          value: item.due_date ? item.due_date : "",
                        })
                      }
                    >
                      {dueLabel(item.due_date, userTimezone)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Business Hub</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
          <span title="Your timezone (used for day rollover)">🌍 {userTimezone}</span>
          <button
            onClick={() => {
              const newTz = prompt("Enter timezone (e.g., America/New_York):", userTimezone);
              if (newTz && newTz.trim()) {
                setUserTimezone(newTz.trim());
              }
            }}
            style={{
              background: "transparent",
              border: "1px solid #ddd",
              borderRadius: 4,
              padding: "0.2rem 0.4rem",
              cursor: "pointer",
              fontSize: "0.8rem",
              color: "#666",
            }}
            title="Change timezone"
          >
            ⚙️
          </button>
        </div>
      </div>
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
        {renderPlannerBucket("today")}
        {renderPlannerBucket("this_week")}
        {renderPlannerBucket("next_week")}

        <div style={{ marginTop: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 700,
              cursor: "pointer",
              userSelect: "none",
              padding: "0.35rem 0",
            }}
            onClick={() => togglePlannerBucket("completed")}
          >
            <span style={{ fontSize: "1rem" }}>{plannerBucketsOpen.completed ? "▾" : "▸"}</span>
            <span>Completed</span>
          </div>
          {plannerBucketsOpen.completed && (
            <div>
              {completedPlanner.length === 0 && <div style={{ color: "#777", fontSize: "0.9rem" }}>No completed</div>}
              {completedPlanner.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem",
                    background: "#f3f3f3",
                    borderRadius: 10,
                    marginBottom: 6,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  <input type="checkbox" checked onChange={() => togglePlannerTask(item)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, textDecoration: "line-through" }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666", minWidth: 110, textAlign: "right" }}>
                    {dueLabel(item.due_date, userTimezone)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Goals */}
      <Section title="Goals" open={sections.goals.open} onToggle={() => toggleSection("goals")}>
        {(["this_week", "this_month", "this_quarter"] as const).map((bucket) => (
          <div key={bucket} style={{ marginBottom: "0.5rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontWeight: 700,
                cursor: "pointer",
                userSelect: "none",
                padding: "0.35rem 0",
              }}
              onClick={() => toggleGoalBucket(bucket)}
            >
              <span style={{ fontSize: "1rem" }}>{goalBucketsOpen[bucket] ? "▾" : "▸"}</span>
              <span>
                {bucket === "this_week" ? "This Week" : bucket === "this_month" ? "This Month" : "This Quarter"}
              </span>
            </div>
            {goalBucketsOpen[bucket] && (
              <>
                {groupedGoals[bucket].length === 0 && (
                  <div style={{ color: "#777", fontSize: "0.9rem" }}>No goals</div>
                )}
                {groupedGoals[bucket].map((g) => {
                  const isEditing = editingGoal?.id === g.id;
                  
                  return (
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
                      {isEditing ? (
                        <div>
                          <input
                            type="text"
                            value={editingGoal.title}
                            onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
                            style={{
                              width: "100%",
                              padding: "0.5rem",
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                              fontFamily: "inherit",
                              fontSize: "1rem",
                              fontWeight: 600,
                              marginBottom: "0.5rem",
                            }}
                            placeholder="Goal title"
                            autoFocus
                          />
                          <textarea
                            value={editingGoal.description}
                            onChange={(e) => setEditingGoal({ ...editingGoal, description: e.target.value })}
                            style={{
                              width: "100%",
                              minHeight: "60px",
                              padding: "0.5rem",
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                              fontFamily: "inherit",
                              fontSize: "0.9rem",
                            }}
                            placeholder="Goal description"
                          />
                          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                            <button
                              onClick={() => saveGoal(g.id, editingGoal.title, editingGoal.description)}
                              disabled={savingGoal}
                              style={{
                                padding: "0.4rem 0.75rem",
                                background: "#2563eb",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                cursor: savingGoal ? "not-allowed" : "pointer",
                                fontSize: "0.85rem",
                              }}
                            >
                              {savingGoal ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingGoal(null)}
                              disabled={savingGoal}
                              style={{
                                padding: "0.4rem 0.75rem",
                                background: "#f3f3f3",
                                color: "#333",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                cursor: savingGoal ? "not-allowed" : "pointer",
                                fontSize: "0.85rem",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => markGoalAsAchieved(g.id)}
                            style={{ marginTop: "0.25rem", cursor: "pointer" }}
                            title="Mark as achieved"
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{g.title}</div>
                            {g.description && (
                              <div style={{ color: "#666", fontSize: "0.9rem", marginTop: 4 }}>{g.description}</div>
                            )}
                          </div>
                          <button
                            onClick={() => setEditingGoal({ id: g.id, title: g.title, description: g.description || "" })}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "1.1rem",
                              padding: "0.25rem",
                              color: "#666",
                            }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ))}

        {/* Achieved Goals Section */}
        <div style={{ marginTop: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 700,
              cursor: "pointer",
              userSelect: "none",
              padding: "0.35rem 0",
            }}
            onClick={() => toggleGoalBucket("achieved")}
          >
            <span style={{ fontSize: "1rem" }}>{goalBucketsOpen.achieved ? "▾" : "▸"}</span>
            <span>Achieved</span>
          </div>
          {goalBucketsOpen.achieved && (
            <div>
              {achievedGoals.length === 0 && (
                <div style={{ color: "#777", fontSize: "0.9rem" }}>No achieved goals</div>
              )}
              {achievedGoals.map((g) => (
                <div
                  key={g.id}
                  style={{
                    padding: "0.6rem",
                    background: "#f9f9f9",
                    borderRadius: 8,
                    marginBottom: 4,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    opacity: 0.75,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.1rem", marginTop: "0.1rem" }}>✅</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, textDecoration: "line-through", color: "#666" }}>
                        {g.title}
                      </div>
                      {g.description && (
                        <div style={{ color: "#888", fontSize: "0.9rem", marginTop: 4 }}>{g.description}</div>
                      )}
                      {g.achieved_at && (
                        <div style={{ color: "#999", fontSize: "0.85rem", marginTop: 4 }}>
                          Achieved: {new Date(g.achieved_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
            {factCategories.map((cat) => {
              if (cat === "custom") {
                // Custom facts: show only those that don't match predefined slots
                const customFacts = factsByCategory[cat];
                if (customFacts.length === 0) return null;
                
                return (
                  <div key={cat} style={{ marginBottom: "0.5rem" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        userSelect: "none",
                        padding: "0.35rem 0",
                        textTransform: "capitalize",
                      }}
                      onClick={() => toggleFactCategory(cat)}
                    >
                      <span style={{ fontSize: "1rem" }}>{factCategoriesOpen[cat] ? "▾" : "▸"}</span>
                      <span>{cat}</span>
                    </div>
                    {factCategoriesOpen[cat] && (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {customFacts.map((f) => (
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
                            <div style={{ marginTop: "0.25rem" }}>{f.fact_value}</div>
                            <div style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: "#666" }}>
                              {f.source_workflow ? `source: ${f.source_workflow}` : "source: n/a"}
                              {f.updated_at ? ` • updated: ${new Date(f.updated_at).toLocaleString()}` : ""}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }
              
              // For predefined categories, show all slots
              const predefinedSlots = PREDEFINED_FACT_SLOTS[cat] || [];
              if (predefinedSlots.length === 0) return null;
              
              return (
                <div key={cat} style={{ marginBottom: "0.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      userSelect: "none",
                      padding: "0.35rem 0",
                      textTransform: "capitalize",
                    }}
                    onClick={() => toggleFactCategory(cat)}
                  >
                    <span style={{ fontSize: "1rem" }}>{factCategoriesOpen[cat] ? "▾" : "▸"}</span>
                    <span>{cat}</span>
                  </div>
                  {factCategoriesOpen[cat] && (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {predefinedSlots.map((slot) => {
                        const existingFact = facts.find((f) => 
                          f.fact_type_id === slot.fact_type_id || f.fact_id === slot.fact_type_id
                        );
                        const isEditing = editingFact?.factTypeId === slot.fact_type_id;
                        
                        return (
                          <li
                            key={slot.fact_type_id}
                            style={{
                              marginBottom: "0.6rem",
                              padding: "0.65rem",
                              background: "#fff",
                              borderRadius: "8px",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{slot.label}</div>
                                {isEditing ? (
                                  <div style={{ marginTop: "0.5rem" }}>
                                    <textarea
                                      value={editingFact.value}
                                      onChange={(e) => setEditingFact({ factTypeId: slot.fact_type_id, value: e.target.value })}
                                      style={{
                                        width: "100%",
                                        minHeight: "80px",
                                        padding: "0.5rem",
                                        border: "1px solid #ccc",
                                        borderRadius: "4px",
                                        fontFamily: "inherit",
                                        fontSize: "0.9rem",
                                      }}
                                      autoFocus
                                    />
                                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                                      <button
                                        onClick={() => saveFact(slot.fact_type_id, editingFact.value, existingFact?.fact_id)}
                                        disabled={savingFact}
                                        style={{
                                          padding: "0.4rem 0.75rem",
                                          background: "#2563eb",
                                          color: "#fff",
                                          border: "none",
                                          borderRadius: "4px",
                                          cursor: savingFact ? "not-allowed" : "pointer",
                                          fontSize: "0.85rem",
                                        }}
                                      >
                                        {savingFact ? "Saving..." : "Save"}
                                      </button>
                                      <button
                                        onClick={() => setEditingFact(null)}
                                        disabled={savingFact}
                                        style={{
                                          padding: "0.4rem 0.75rem",
                                          background: "#f3f3f3",
                                          color: "#333",
                                          border: "1px solid #ddd",
                                          borderRadius: "4px",
                                          cursor: savingFact ? "not-allowed" : "pointer",
                                          fontSize: "0.85rem",
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {existingFact ? (
                                      <>
                                        <div style={{ marginTop: "0.25rem", whiteSpace: "pre-wrap" }}>
                                          {existingFact.fact_value}
                                        </div>
                                        <div style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: "#666" }}>
                                          {existingFact.source_workflow ? `source: ${existingFact.source_workflow}` : "source: n/a"}
                                          {existingFact.updated_at ? ` • updated: ${new Date(existingFact.updated_at).toLocaleString()}` : ""}
                                        </div>
                                      </>
                                    ) : (
                                      <div style={{ marginTop: "0.25rem", color: "#999", fontStyle: "italic", fontSize: "0.9rem" }}>
                                        {slot.description}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              {!isEditing && (
                                <button
                                  onClick={() => setEditingFact({ factTypeId: slot.fact_type_id, value: existingFact?.fact_value || "" })}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "1.1rem",
                                    padding: "0.25rem",
                                    color: "#666",
                                  }}
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
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
