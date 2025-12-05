// lib/config.ts
import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

// ---------- GLOBAL STRINGS ----------

export const PLACEHOLDER_INPUT = "Ask anything…";

export const GREETING =
  "How can I help you today?"; // fallback if we ever get an unknown agent

export const STARTER_PROMPTS: StartScreenPrompt[] = [];

// ---------- PER-AGENT GREETINGS ----------
//
// NOTE: ChatKit is collapsing explicit \n, so these are written to
// naturally wrap into two lines within the current container width.
//

export const GREETINGS: Record<string, string> = {
  // Business main
  business:
    "You’re not broken, the world is weird right now. Let’s build you a real business.",

  // Product pillar
  product:
    "You’re not broken, the world is weird right now. Let’s shape a clear, simple offer.",

  // Marketing pillar
  marketing:
    "You’re not broken, the world is weird right now. Let’s find the right people to talk to.",

  // Finance pillar
  finance:
    "You’re not broken, the world is weird right now. Let’s see if your numbers really add up.",

  // Reality Check task
  reality_check:
    "I’m your Reality Check. I’ll tell you straight what works, what’s shaky, and what to test first.",

  // SWOT task
  swot:
    "I’ll map out a quick SWOT so you can see strengths, risks, and options.",

  // Legal & Tax Checkup task
  legal_tax:
    "I’ll flag general legal and tax areas to ask a professional about. This is not legal or tax advice.",
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
      label: "I already have an idea → turn it into a full plan",
      prompt:
        "I already have a business idea. Please treat this as my starting point and help me turn it into a full, realistic business plan.",
      icon: "circle-question",
    },
    {
      label: "I have no idea yet → help me find a good one",
      prompt:
        "I don’t have a concrete business idea yet. Please help me find a realistic idea that fits my skills, money, and time, then outline the first steps.",
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
      label: "Upload or paste your plan to get started",
      prompt:
        "I’m pasting or uploading my current plan. Please read it and act as a reality check: tell me what looks solid, what seems shaky, and exactly what to test first.",
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
// Force DARK mode, tinted grayscale OFF, custom surface colors:
// - background: #1B202C
// - foreground: #272D40
//

export const getThemeConfig = (_theme: ColorScheme): ThemeOption => ({
  colorScheme: "dark",
  radius: "round",
  density: "normal",
  color: {
    // No grayscale block -> tinted grayscale effectively off
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
