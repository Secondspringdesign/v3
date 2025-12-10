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
    "Let’s build you a real business, one that fits your life right now.",
  product:
    "Describe what you’re thinking of selling and who it’s for. We’ll turn it into a clearer offer.",
  marketing:
    "Tell me who you want to reach. We’ll shape a simple message and a couple of realistic channels.",
  finance:
    "Share your pricing and income hopes. We’ll do a quick math check to see if it holds together.",
  reality_check:
    "I’m your Reality Check. I’ll tell you straight what works, what’s shaky, and what to test first.",
  swot:
    "I’ll map out a quick SWOT so you can see strengths, risks, and options.",
  legal_tax:
    "I’ll flag general legal and tax areas to ask a professional about. This is not legal or tax advice.",
};

export function getGreetingForAgent(agent?: string) {
  if (!agent) return GREETING;
  return GREETINGS[agent] ?? GREETING;
}

// ---------- PER-AGENT STARTER PROMPTS ----------

export const STARTER_PROMPTS_BY_AGENT: Record<string, StartScreenPrompt[]> = {
  business: [
    {
      label: "I already have an idea → turn it into a full plan",
      prompt:
        "I already have a business idea. Please treat this as my starting point and help me turn it into a full, realistic business plan.",
      icon: "lightbulb",
    },
    {
      label: "I have no idea yet → help me find a good one",
      prompt:
        "I don’t have a concrete business idea yet. Please help me find a realistic idea that fits my skills, money, and time, then outline the first steps.",
      icon: "compass",
    },
    {
      label: "You’re not broken, the world is weird right now.",
      prompt:
        "You’re not broken, the world is weird right now. Help me think about my situation and what kind of business could actually work for me.",
      icon: "lifesaver",
    },
  ],
  product: [
    {
      label: "Define my offer",
      prompt:
        "Here’s my rough idea. Help me turn it into a clear offer someone would understand and want to buy.",
      icon: "square-text",
    },
    {
      label: "Choose a simple niche",
      prompt:
        "Here’s what I’m thinking of selling. Help me pick a specific type of customer to focus on first.",
      icon: "map-pin",
    },
  ],
  marketing: [
    {
      label: "Who am I really talking to?",
      prompt:
        "Here’s my business idea. Help me define a clear target customer I can picture and talk to directly.",
      icon: "profile",
    },
    {
      label: "Write a simple pitch for me",
      prompt:
        "Here’s my idea and who I think it’s for. Write a one‑sentence pitch I can use on my site or in an email.",
      icon: "mail",
    },
  ],
  finance: [
    {
      label: "Sanity‑check my pricing",
      prompt:
        "Here’s what I’m planning to sell and what I was thinking of charging. Help me sanity‑check this pricing.",
      icon: "analytics",
    },
    {
      label: "Could this actually cover my bills?",
      prompt:
        "Here’s my idea, rough pricing, and what I’d like to earn per month. Help me see if the math is realistic.",
      icon: "chart",
    },
  ],
  reality_check: [
    {
      label: "Upload or paste your plan to get started",
      prompt:
        "I’m pasting or uploading my current plan. Please read it and act as a reality check: tell me what looks solid, what seems shaky, and exactly what to test first.",
      icon: "check-circle",
    },
  ],
  swot: [
    {
      label: "Give me a quick SWOT for this plan",
      prompt:
        "Here’s my current plan. Create a brief SWOT analysis and highlight what to lean into and what to watch out for.",
      icon: "compass",
    },
    {
      label: "I’m not sure where to take this next",
      prompt:
        "Here’s my plan and the main directions I’m considering next. Compare them using a SWOT so I can see which looks better for the next year.",
      icon: "analytics",
    },
  ],
  legal_tax: [
    {
      label: "Scan my plan for legal and tax areas",
      prompt:
        "Here’s my plan and where I’m based. Highlight the main legal and tax areas I should pay attention to, in simple language. I know this isn’t legal or tax advice.",
      icon: "bug",
    },
    {
      label: "Help me prepare for a pro",
      prompt:
        "Here’s my plan and where I’m based. Turn this into a short list of questions I can bring to a lawyer or accountant.",
      icon: "notebook-pencil",
    },
  ],
};

export function getStarterPromptsForAgent(agent?: string): StartScreenPrompt[] {
  if (!agent) return STARTER_PROMPTS;
  return STARTER_PROMPTS_BY_AGENT[agent] ?? STARTER_PROMPTS;
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
