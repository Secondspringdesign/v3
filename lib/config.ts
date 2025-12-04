// lib/config.ts
import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

// ---------- GLOBAL STRINGS ----------

export const PLACEHOLDER_INPUT = "Ask anything…";

export const GREETING =
  "How can I help you today?"; // fallback if we ever get an unknown agent

// Default starter prompts (rarely used now; most agents have their own)
export const STARTER_PROMPTS: StartScreenPrompt[] = [];

// ---------- PER-AGENT GREETINGS ----------
//
// Agent keys come from the `?agent=` query parameter in the URL.
// Current mapping:
//
// business      -> Business main workflow
// product       -> Product main workflow
// marketing     -> Marketing main workflow
// finance       -> Finance main workflow
// reality_check -> Business task: Reality Check
// swot          -> Business task: SWOT
// legal_tax     -> Business task: Legal & Tax Checkup
//

export const GREETINGS: Record<string, string> = {
  business:
    "You’re not broken, the world is weird. Let’s shape a business that fits your life and turn it into a simple plan.",
  product:
    "In Product, we define what you’re offering, who it’s for, and why it’s worth paying for.",
  marketing:
    "In Marketing, we figure out who you’re talking to, what to say, and a simple way to reach them.",
  finance:
    "In Finance, we keep the numbers simple: pricing, basic costs, and whether the math makes sense.",
  reality_check:
    "Reality Check looks at your plan like an early‑stage investor: what works, what’s shaky, and what to test first.",
  swot:
    "SWOT Analysis maps your strengths, weaknesses, opportunities, and threats so you can see the whole picture.",
  legal_tax:
    "Legal & Tax Checkup points out areas to pay attention to. This is general information, not legal or tax advice.",
};

// Helper to get a greeting for a given agent (falls back to global GREETING)
export function getGreetingForAgent(agent?: string) {
  if (!agent) return GREETING;
  return GREETINGS[agent] ?? GREETING;
}

// ---------- PER-AGENT STARTER PROMPTS ----------
//
// Treat these like simple buttons to get going.
// We keep labels short and prompts concise.
// Icons: use only \"circle-question\" to stay within ChatKitIcon types.
//

export const STARTER_PROMPTS_BY_AGENT: Record<string, StartScreenPrompt[]> = {
  // Business main
  business: [
    {
      label: "I just lost my job, what do I do?",
      prompt:
        "I just lost my job. Help me see what kind of business could make sense for me and the smallest next steps.",
      icon: "circle-question",
    },
    {
      label: "Turn my idea into a Lite Business Plan",
      prompt:
        "Here’s my idea. Turn it into a short Lite Business Plan with clear next steps.",
      icon: "circle-question",
    },
  ],

  // Product main
  product: [
    {
      label: "Define my offer",
      prompt:
        "Help me turn my rough idea into a clear offer someone would understand and want to buy.",
      icon: "circle-question",
    },
    {
      label: "Choose a niche",
      prompt:
        "Here’s my idea. Help me pick a specific type of customer or niche to focus on first.",
      icon: "circle-question",
    },
  ],

  // Marketing main
  marketing: [
    {
      label: "Who am I actually talking to?",
      prompt:
        "Here’s my business idea. Help me define a clear target customer I can picture and talk to directly.",
      icon: "circle-question",
    },
    {
      label: "Write a simple pitch",
      prompt:
        "Help me write a one‑sentence pitch for my business that a friend would understand immediately.",
      icon: "circle-question",
    },
  ],

  // Finance main
  finance: [
    {
      label: "Sanity‑check my pricing",
      prompt:
        "Here’s what I’m planning to sell and what I was thinking of charging. Help me sanity‑check this pricing.",
      icon: "circle-question",
    },
    {
      label: "Can this cover my bills?",
      prompt:
        "Here’s my idea, rough pricing, and what I’d like to earn per month. Help me see if the numbers are realistic.",
      icon: "circle-question",
    },
  ],

  // Business task – Reality Check
  // Assumes they already have a plan, usually from the Business builder.
  reality_check: [
    {
      label: "Check the plan I already wrote",
      prompt:
        "I’ll paste my plan. Review it and tell me what seems solid, what’s shaky, and what needs testing.",
      icon: "circle-question",
    },
    {
      label: "What should I test in the next 30 days?",
      prompt:
        "Given this plan, what are the 3–5 most important things I should test in the next 30 days?",
      icon: "circle-question",
    },
  ],

  // Business task – SWOT Analysis
  swot: [
    {
      label: "Give me a SWOT for my current plan",
      prompt:
        "Here’s my current business plan. Create a clear SWOT and highlight the key points I should focus on.",
      icon: "circle-question",
    },
    {
      label: "I’m not sure where to take my business next",
      prompt:
        "I’m torn about what to do next with this business. Compare the main directions I’m considering and show how they look in a SWOT.",
      icon: "circle-question",
    },
  ],

  // Business task – Legal & Tax Checkup
  legal_tax: [
    {
      label: "Scan my plan for legal and tax issues",
      prompt:
        "Here’s my plan. Highlight the main legal and tax areas I should pay attention to, in simple language.",
      icon: "circle-question",
    },
    {
      label: "Prepare for a call with a pro",
      prompt:
        "Here’s my plan and where I’m based. Turn this into a short list of questions to bring to a lawyer or accountant.",
      icon: "circle-question",
    },
  ],
};

// Helper to get starter prompts for a given agent.
export function getStarterPromptsForAgent(agent?: string): StartScreenPrompt[] {
  if (!agent) return STARTER_PROMPTS;
  return STARTER_PROMPTS_BY_AGENT[agent] ?? STARTER_PROMPTS;
}

// ---------- THEME CONFIG ----------
//
// Match the ChatKit Playground: dark scheme, tinted grayscale (hue 222, tint 5),
// normal density, round corners, Inter 16px.
//

export const getThemeConfig = (_theme: ColorScheme): ThemeOption => ({
  colorScheme: "dark",
  radius: "round",
  density: "normal",
  color: {
    grayscale: {
      hue: 222,
      tint: 5,
      shade: 0,
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
    ],
  },
});
