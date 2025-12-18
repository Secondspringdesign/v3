import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

// ---------- GLOBAL STRINGS ----------

export const PLACEHOLDER_INPUT = "Ask anything…";

export const GREETING = "How can I help you today?"; // fallback if we ever get an unknown agent

export const STARTER_PROMPTS: StartScreenPrompt[] = [];

// ---------- PER-AGENT GREETINGS ----------

export const GREETINGS: Record<string, string> = {
  // Business main
  business:
    "You don’t have to have it all figured out. Bring whatever you’ve got — we’ll move forward from there.",

  // Product pillar
  product:
    "Describe what you’re thinking of selling and who it’s for. We’ll turn it into a clearer offer.",

  // Marketing pillar
  marketing:
    "Tell me who you want to reach. We’ll shape a simple message and a couple of realistic channels.",

  // Money pillar (formerly finance)
  money:
    "Share your pricing and income hopes. We’ll do a quick math check to see if it holds together.",

  // Business tasks
  business_task1:
    "I run a real market feasibility review. I'll tell you straight what works, what's shaky, and what to test first.",
  business_task2:
    "I'll map out strengths, weaknesses, opportunities, and threats for your plan.",
  business_task3:
    "I'll walk you through the fundamentals step by step — no rush, just general info to get you started.",
  business_task4:
    "Ready to turn your Lite Business Plan into daily action? \n\nLet's get your first 30 days planned — one small step at a time!",

  // Planner (alias for business_task4, if used)
  planner:
    "Ready to turn your Lite Business Plan into daily action? \n\nLet's get your first 30 days planned — one small step at a time!",

  // Reality Check task
  reality_check:
    "I run a real market feasibility review. I'll tell you straight what works, what's shaky, and what to test first.",

  // SWOT task
  swot: "I'll map out strengths, weaknesses, opportunities, and threats for your plan.",

  // Legal & Tax Checkup task
  legal_tax:
    "I'll walk you through the fundamentals step by step — no rush, just general info to get you started.",
};

export function getGreetingForAgent(agent?: string) {
  if (!agent) return GREETING;
  return GREETINGS[agent] ?? GREETING;
}

// ---------- PER-AGENT STARTER PROMPTS (DESKTOP) ----------
// Labels are identical to prompts per your request.

export const STARTER_PROMPTS_BY_AGENT: Record<string, StartScreenPrompt[]> = {
  // Business main (desktop)
  business: [
    {
      label: "I have an idea → let’s turn it into a full plan",
      prompt: "I have an idea → let’s turn it into a full plan",
      icon: "lightbulb",
    },
    {
      label: "No idea yet → help me find one that feels right",
      prompt: "No idea yet → help me find one that feels right",
      icon: "compass",
    },
    {
      label: "I have a plan → let’s make it better",
      prompt: "I have a plan → let’s make it better",
      icon: "sparkle",
    },
    {
      label: "Just have a question → ask me anything",
      prompt: "Just have a question → ask me anything",
      icon: "mail",
    },
  ],

  // Product main
  product: [
    {
      label:
        "Here’s my rough idea. Help me turn it into a clear offer someone would understand and want to buy.",
      prompt:
        "Here’s my rough idea. Help me turn it into a clear offer someone would understand and want to buy.",
      icon: "square-text",
    },
    {
      label:
        "Here’s what I’m thinking of selling. Help me pick a specific type of customer to focus on first.",
      prompt:
        "Here’s what I’m thinking of selling. Help me pick a specific type of customer to focus on first.",
      icon: "map-pin",
    },
  ],

  // Marketing main
  marketing: [
    {
      label:
        "Here’s my business idea. Help me define a clear target customer I can picture and talk to directly.",
      prompt:
        "Here’s my business idea. Help me define a clear target customer I can picture and talk to directly.",
      icon: "profile",
    },
    {
      label:
        "Here’s my idea and who I think it’s for. Write a one‑sentence pitch I can use on my site or in an email.",
      prompt:
        "Here’s my idea and who I think it’s for. Write a one‑sentence pitch I can use on my site or in an email.",
      icon: "mail",
    },
  ],

  // Money main (replaces canonical "finance" key)
  money: [
    {
      label:
        "Here’s what I’m planning to sell and what I was thinking of charging. Help me sanity‑check this pricing.",
      prompt:
        "Here’s what I’m planning to sell and what I was thinking of charging. Help me sanity‑check this pricing.",
      icon: "analytics",
    },
    {
      label:
        "Here’s my idea, rough pricing, and what I’d like to earn per month. Help me see if the math is realistic.",
      prompt:
        "Here’s my idea, rough pricing, and what I’d like to earn per month. Help me see if the math is realistic.",
      icon: "chart",
    },
  ],

  // === UPDATED BUSINESS TASK PROMPTS AND ALIASES ===
  business_task1: [
    {
      label: "Upload or paste your plan and run a market feasibility review.",
      prompt: "Upload or paste your plan and run a market feasibility review.",
      icon: "check-circle",
    },
  ],
  business_task2: [
    {
      label: "Upload or paste your plan to create a quick SWOT.",
      prompt: "Upload or paste your plan to create a quick SWOT.",
      icon: "compass",
    },
  ],
  business_task3: [
    {
      label: "Upload or paste your business idea/plan (or just tell me about it) and we'll begin.",
      prompt: "Upload or paste your business idea/plan (or just tell me about it) and we'll begin.",
      icon: "bug",
    },
  ],
  business_task4: [
    {
      label: "Upload or paste your plan (PDF or text) to get started.",
      prompt: "Upload or paste your plan (PDF or text) to get started.",
      icon: "notebook-pencil",
    },
  ],
  planner: [
    {
      label: "Upload or paste your plan (PDF or text) to get started.",
      prompt: "Upload or paste your plan (PDF or text) to get started.",
      icon: "notebook-pencil",
    },
  ],

  // === UPDATED REALITY CHECK, SWOT, LEGAL_TAX ALIASES ===
  reality_check: [
    {
      label: "Upload or paste your plan and run a market feasibility review.",
      prompt: "Upload or paste your plan and run a market feasibility review.",
      icon: "check-circle",
    },
  ],
  swot: [
    {
      label: "Upload or paste your plan to create a quick SWOT.",
      prompt: "Upload or paste your plan to create a quick SWOT.",
      icon: "compass",
    },
  ],
  legal_tax: [
    {
      label: "Upload or paste your business idea/plan (or just tell me about it) and we'll begin.",
      prompt: "Upload or paste your business idea/plan (or just tell me about it) and we'll begin.",
      icon: "bug",
    },
  ],
};

export function getStarterPromptsForAgent(agent?: string): StartScreenPrompt[] {
  if (!agent) return STARTER_PROMPTS;
  return STARTER_PROMPTS_BY_AGENT[agent] ?? STARTER_PROMPTS;
}

// ---------- PER-AGENT STARTER PROMPTS (MOBILE) ----------
// Only Business gets mobile prompts; all others get NONE on mobile.

export const STARTER_PROMPTS_MOBILE_BY_AGENT: Record<string, StartScreenPrompt[]> = {
  business: [
    { label: "Ideate", prompt: "Ideate", icon: "lightbulb" },
    { label: "Create", prompt: "Create", icon: "notebook-pencil" },
    { label: "Refine", prompt: "Refine", icon: "sparkle" },
  ],
  business_task1: [],
  business_task2: [],
  business_task3: [],
  business_task4: [],
  planner: [],
  reality_check: [],
  swot: [],
  legal_tax: [],
};

export function getMobilePromptsForAgent(agent?: string): StartScreenPrompt[] | null {
  if (!agent) return STARTER_PROMPTS_MOBILE_BY_AGENT["business"] ?? null;
  if (agent === "business") return STARTER_PROMPTS_MOBILE_BY_AGENT["business"] ?? null;
  // No mobile prompts for any tasks, planner, or other agents.
  return [];
}

// ---------- THEME CONFIG ----------

export const getThemeConfig = (_theme: ColorScheme): ThemeOption => ({
  colorScheme: "dark",
  radius: "round",
  density: "normal",
  color: {
    surface: {
      background: "#1B202C",
      foreground: "#272D40",
    },
  },
  typography: {
    baseSize: 16,
    fontFamily: "Inter, sans-serif",
    fontSources: [
      {
        family: "Inter",
        src: "https://rsms.me/inter/font-files/Inter-Regular.woff2",
        weight: 400,
        style: "normal",
      },
      {
        family: "Inter",
        src: "https://rsms.me/inter/font-files/Inter-Medium.woff2",
        weight: 500,
        style: "normal",
      },
      {
        family: "Inter",
        src: "https://rsms.me/inter/font-files/Inter-SemiBold.woff2",
        weight: 600,
        style: "normal",
      },
    ],
  },
});
