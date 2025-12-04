// lib/config.ts
import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

// ---------- GLOBAL STRINGS ----------

export const PLACEHOLDER_INPUT = "Ask anything…";

export const GREETING =
  "How can I help you today?"; // fallback if we ever get an unknown agent

export const STARTER_PROMPTS: StartScreenPrompt[] = [];

// ---------- PER-AGENT GREETINGS ----------

export const GREETINGS: Record<string, string> = {
  business:
    "You’re not broken, the world is weird. Paste or write your idea here and I’ll help you turn it into a simple plan.",
  product:
    "Describe what you’re thinking of selling and who it’s for. We’ll turn it into a clearer offer.",
  marketing:
    "Tell me who you want to reach. We’ll shape a simple message and a couple of realistic channels.",
  finance:
    "Share your pricing and income hopes. We’ll do a quick math check to see if it holds together.",
  reality_check:
    "Upload or paste your plan to get a reality check: what works, what’s shaky, and what to test first.",
  swot:
    "Paste your current plan and I’ll map out a quick SWOT so you can see strengths, risks, and options.",
  legal_tax:
    "Paste your plan and where you’re based. I’ll flag general legal and tax areas to ask a professional about. This is not legal or tax advice.",
};

export function getGreetingForAgent(agent?: string) {
  if (!agent) return GREETING;
  return GREETINGS[agent] ?? GREETING;
}

// ---------- PER-AGENT STARTER PROMPTS ----------
//
// Only using the known-safe icon "circle-question" to avoid type errors.
//

export const STARTER_PROMPTS_BY_AGENT: Record<string, StartScreenPrompt[]> = {
  // Business main
  business: [
    {
      label: "I just lost my job—help me use this",
      prompt:
        "I just lost my job. Here’s my background and constraints. Help me see what kind of business could make sense and what my first steps could be.",
      icon: "circle-question",
    },
    {
      label: "Turn my idea into a Lite Business Plan",
      prompt:
        "Here’s my idea. Turn it into a short Lite Business Plan with audience, problem, offer, delivery, pricing, and next steps.",
      icon: "circle-question",
    },
  ],

  // Product main
  product: [
    {
      label: "Define my offer",
      prompt:
        "Here’s my rough idea. Help me turn it into a clear offer someone would understand and want to buy.",
      icon: "circle-question",
    },
    {
      label: "Choose a simple niche",
      prompt:
        "Here’s what I’m thinking of selling. Help me pick a specific type of customer to focus on first.",
      icon: "circle-question",
    },
  ],

  // Marketing main
  marketing: [
    {
      label: "Who am I really talking to?",
      prompt:
        "Here’s my business idea. Help me define a clear target customer I can picture and talk to directly.",
      icon: "circle-question",
    },
    {
      label: "Write a simple pitch for me",
      prompt:
        "Here’s my idea and who I think it’s for. Write a one‑sentence pitch I can use on my site or in an email.",
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
      label: "Could this actually cover my bills?",
      prompt:
        "Here’s my idea, rough pricing, and what I’d like to earn per month. Help me see if the math is realistic.",
      icon: "circle-question",
    },
  ],

  // Reality Check task
  reality_check: [
    {
      label: "Review the plan I already wrote",
      prompt:
        "I’ll paste my plan from the builder. Review it and tell me what seems solid, what’s shaky, and what needs testing.",
      icon: "circle-question",
    },
    {
      label: "What should I test in the next 30 days?",
      prompt:
        "Here’s my current plan. Tell me the 3–5 most important things to test in the next 30 days before I commit more time and money.",
      icon: "circle-question",
    },
  ],

  // SWOT task
  swot: [
    {
      label: "Give me a quick SWOT for this plan",
      prompt:
        "Here’s my current plan. Create a brief SWOT analysis and highlight what to lean into and what to watch out for.",
      icon: "circle-question",
    },
    {
      label: "I’m not sure where to take this next",
      prompt:
        "Here’s my plan and the main directions I’m considering next. Compare them using a SWOT so I can see which looks better for the next year.",
      icon: "circle-question",
    },
  ],

  // Legal & Tax Checkup task
  legal_tax: [
    {
      label: "Scan my plan for legal and tax areas",
      prompt:
        "Here’s my plan and where I’m based. Highlight the main legal and tax areas I should pay attention to, in simple language. I know this isn’t legal or tax advice.",
      icon: "circle-question",
    },
    {
      label: "Help me prepare for a pro",
      prompt:
        "Here’s my plan and where I’m based. Turn this into a short list of questions I can bring to a lawyer or accountant.",
      icon: "circle-question",
    },
  ],
};

export function getStarterPromptsForAgent(agent?: string): StartScreenPrompt[] {
  if (!agent) return STARTER_PROMPTS;
  return STARTER_PROMPTS_BY_AGENT[agent] ?? STARTER_PROMPTS;
}

// ---------- THEME CONFIG ----------
//
// Always dark mode with tinted grayscale (hue 222, tint 5).
// Satisfies your SurfaceColors type: background + foreground.
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
    surface: {
      background: "#020617", // very dark slate
      foreground: "#E5E7EB", // light gray text (tailwind slate-200)
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
