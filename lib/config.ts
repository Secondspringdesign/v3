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

  // Finance pillar (Money)
  finance:
    "Share your pricing and income hopes. We’ll do a quick math check to see if it holds together.",

  // Business tasks
  business_task1:
    "I’m your Reality Check. I’ll tell you straight what works, what’s shaky, and what to test first.",
  business_task2:
    "I’ll map out a quick SWOT so you can see strengths, risks, and options.",
  business_task3:
    "I’ll flag general legal and tax areas to ask a professional about. This is not legal or tax advice.",

  // Reality Check task
  reality_check:
    "I’m your Reality Check. I’ll tell you straight what works, what’s shaky, and what to test first.",

  // SWOT task
  swot: "I’ll map out a quick SWOT so you can see strengths, risks, and options.",

  // Legal & Tax Checkup task
  legal_tax:
    "I’ll flag general legal and tax areas to ask a professional about. This is not legal or tax advice.",
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

  // Finance main (Money)
  finance: [
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

  // Business tasks (map to existing task prompt sets)
  business_task1: [
    {
      label:
        "I’m pasting or uploading my current plan. Please read it and act as a reality check: tell me what looks solid, what seems shaky, and exactly what to test first.",
      prompt:
        "I’m pasting or uploading my current plan. Please read it and act as a reality check: tell me what looks solid, what seems shaky, and exactly what to test first.",
      icon: "check-circle",
    },
  ],
  business_task2: [
    {
      label:
        "Here’s my current plan. Create a brief SWOT analysis and highlight what to lean into and what to watch out for.",
      prompt:
        "Here’s my current plan. Create a brief SWOT analysis and highlight what to lean into and what to watch out for.",
      icon: "compass",
    },
    {
      label:
        "Here’s my plan and the main directions I’m considering next. Compare them using a SWOT so I can see which looks better for the next year.",
      prompt:
        "Here’s my plan and the main directions I’m considering next. Compare them using a SWOT so I can see which looks better for the next year.",
      icon: "analytics",
    },
  ],
  business_task3: [
    {
      label:
        "Here’s my plan and where I’m based. Highlight the main legal and tax areas I should pay attention to, in simple language. I know this isn’t legal or tax advice.",
      prompt:
        "Here’s my plan and where I’m based. Highlight the main legal and tax areas I should pay attention to, in simple language. I know this isn’t legal or tax advice.",
      icon: "bug",
    },
    {
      label:
        "Here’s my plan and where I’m based. Turn this into a short list of questions I can bring to a lawyer or accountant.",
      prompt:
        "Here’s my plan and where I’m based. Turn this into a short list of questions I can bring to a lawyer or accountant.",
      icon: "notebook-pencil",
    },
  ],

  // Reality Check task
  reality_check: [
    {
      label:
        "I’m pasting or uploading my current plan. Please read it and act as a reality check: tell me what looks solid, what seems shaky, and exactly what to test first.",
      prompt:
        "I’m pasting or uploading my current plan. Please read it and act as a reality check: tell me what looks solid, what seems shaky, and exactly what to test first.",
      icon: "check-circle",
    },
  ],

  // SWOT task
  swot: [
    {
      label:
        "Here’s my current plan. Create a brief SWOT analysis and highlight what to lean into and what to watch out for.",
      prompt:
        "Here’s my current plan. Create a brief SWOT analysis and highlight what to lean into and what to watch out for.",
      icon: "compass",
    },
    {
      label:
        "Here’s my plan and the main directions I’m considering next. Compare them using a SWOT so I can see which looks better for the next year.",
      prompt:
        "Here’s my plan and the main directions I’m considering next. Compare them using a SWOT so I can see which looks better for the next year.",
      icon: "analytics",
    },
  ],

  // Legal & Tax Checkup task
  legal_tax: [
    {
      label:
        "Here’s my plan and where I’m based. Highlight the main legal and tax areas I should pay attention to, in simple language. I know this isn’t legal or tax advice.",
      prompt:
        "Here’s my plan and where I’m based. Highlight the main legal and tax areas I should pay attention to, in simple language. I know this isn’t legal or tax advice.",
      icon: "bug",
    },
    {
      label:
        "Here’s my plan and where I’m based. Turn this into a short list of questions I can bring to a lawyer or accountant.",
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

// ---------- PER-AGENT STARTER PROMPTS (MOBILE) ----------
// Labels == prompts per request. Only Business customized; others fall back to desktop set.

export const STARTER_PROMPTS_MOBILE_BY_AGENT: Record<string, StartScreenPrompt[]> = {
  business: [
    { label: "Ideate", prompt: "Ideate", icon: "lightbulb" },
    { label: "Create", prompt: "Create", icon: "notebook-pencil" },
    { label: "Refine", prompt: "Refine", icon: "sparkle" },
  ],
};

export function getMobilePromptsForAgent(agent?: string): StartScreenPrompt[] | null {
  if (!agent) return STARTER_PROMPTS_MOBILE_BY_AGENT["business"] ?? null;
  return STARTER_PROMPTS_MOBILE_BY_AGENT[agent] ?? null;
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
