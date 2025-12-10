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
// ChatKit treats greetings as plain text (no hard line breaks).
// We keep them compact and let the starter prompts carry more nuance.
//

export const GREETINGS: Record<string, string> = {
  // Business main
  business:
    "Let’s build you a real business, one that fits your life right now.",

  // Product pillar
  product:
    "Describe what you’re thinking of selling and who it’s for. We’ll turn it into a clearer offer.",

  // Marketing pillar
  marketing:
    "Tell me who you want to reach. We’ll shape a simple message and a couple of realistic channels.",

  // Finance pillar
  finance:
    "Share your pricing and income hopes. We’ll do a quick math check to see if it holds together.",

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
// Icons are all from the supported ChatKit icon set.
//

export const STARTER_PROMPTS_BY_AGENT: Record<string, StartScreenPrompt[]> = {
  // Business main
  business: [
    {
      label: "I already have an idea → turn it into a full plan",
      prompt:
        "I already have a business idea. Please treat this as my starting point and help me turn it into a full, realistic business plan.",
      icon: "lightbulb", // idea spark
    },
    {
      label: "I have no idea yet → help me find a good one",
      prompt:
        "I don’t have a concrete business idea yet. Please help me find a realistic idea that fits my skills, money, and time, then outline the first steps.",
      icon: "compass", // exploration / direction
    },
    {
      label: "You’re not broken, the world is weird right now.",
      prompt:
        "You’re not broken, the world is weird right now. Help me think about my situation and what kind of business could actually work for me.",
      icon: "lifesaver", // supportive, grounding
    },
  ],

  // Product main
  product: [
    {
      label: "Define my offer",
      prompt:
        "Here’s my rough idea. Help me turn it into a clear offer someone would understand and want to buy.",
      icon: "square-text", // product description
    },
    {
      label: "Choose a simple niche",
      prompt:
        "Here’s what I’m thinking of selling. Help me pick a specific type of customer to focus on first.",
      icon: "map-pin", // targeted niche
    },
  ],

  // Marketing main
  marketing: [
    {
      label: "Who am I really talking to?",
      prompt:
        "Here’s my business idea. Help me define a clear target customer I can picture and talk to directly.",
      icon: "profile", // customer focus
    },
    {
      label: "Write a simple message",
      prompt:
        "Given this idea and target, help me write a simple message I can actually say out loud or type in a DM.",
      icon: "megaphone", // message
    },
  ],

  // Finance main
  finance: [
    {
      label: "Check if my numbers make sense",
      prompt:
        "Here’s my rough pricing and income goal. Help me see if the math basically works and what would need to change.",
      icon: "calculator", // numbers check
    },
  ],

  // Reality Check task
  reality_check: [
    {
      label: "Be brutally honest about this plan",
      prompt:
        "Here’s my plan. Be honest about what’s strong, what’s weak, and what I should test first.",
      icon: "triangle-alert", // caution
    },
  ],

  // SWOT task
  swot: [
    {
      label: "Give me a quick SWOT",
      prompt:
        "Here’s my idea. Give me a quick SWOT so I can see strengths, weaknesses, opportunities, and threats.",
      icon: "grid-3x3", // matrix
    },
  ],

  // Legal & Tax Checkup task
  legal_tax: [
    {
      label: "What should I ask a professional?",
      prompt:
        "Given this business idea and where I live, what general legal and tax topics should I ask a professional about? I know you’re not giving legal or tax advice.",
      icon: "scale", // legal scale
    },
  ],
};

export function getStarterPromptsForAgent(agent?: string): StartScreenPrompt[] {
  if (!agent) return STARTER_PROMPTS;
  return STARTER_PROMPTS_BY_AGENT[agent] ?? STARTER_PROMPTS;
}

// ---------- THEME CONFIG ----------

export function getThemeConfig(colorScheme: ColorScheme): ThemeOption {
  return {
    appearance: colorScheme, // "light" | "dark" | "system"
    // extend this if you’re using more theme options
  };
}
