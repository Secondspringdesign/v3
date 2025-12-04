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
    "You’re not broken, the world is weird.\n\nThis is your workspace for planning a business that fits your life. Together we’ll shape your idea, turn it into a Lite Business Plan, do a reality check, and give you easy next steps.",
  product:
    "This is your Product workspace. We’ll clarify what you’re offering, who it’s for, and why it’s worth paying for—without turning it into a giant startup deck.",
  marketing:
    "This is your Marketing workspace. We’ll figure out who you’re talking to, what to say, and a simple way to reach them—no growth hacks, just honest, doable marketing.",
  finance:
    "This is your Finance workspace. We’ll keep it simple: what you charge, what it costs you, and whether the math makes sense for your life and energy.",
  reality_check:
    "Welcome to Reality Check. Paste your plan or describe your idea, and I’ll review it like a calm early‑stage investor: what looks promising, what’s risky, and what might need testing before you go all‑in.",
  swot:
    "Welcome to SWOT Analysis. Share your business or idea, and I’ll map out your strengths, weaknesses, opportunities, and threats—then highlight what to lean into and what to watch out for.",
  legal_tax:
    "Welcome to Legal & Tax Checkup. I’m not a lawyer or tax professional, so I can’t tell you if you’re fully compliant.\n\nWhat I can do is read your plan, highlight the main legal and tax areas to pay attention to, and help you draft better questions for a real professional in your area.",
};

// Helper to get a greeting for a given agent (falls back to global GREETING)
export function getGreetingForAgent(agent?: string) {
  if (!agent) return GREETING;
  return GREETINGS[agent] ?? GREETING;
}

// ---------- PER-AGENT STARTER PROMPTS ----------

export const STARTER_PROMPTS_BY_AGENT: Record<string, StartScreenPrompt[]> = {
  // Business main
  business: [
    {
      label: "I just lost my job, what do I do?",
      prompt:
        "I just lost my job. Help me figure out what kind of business I could start, based on my skills and constraints, and what my very first steps should be.",
      icon: "circle-question",
    },
    {
      label: "I’ve never made a business before—where do we start?",
      prompt:
        "I’ve never started a business before. Walk me through the basics and help me shape a business idea that could actually work for me.",
      icon: "sparkle",
    },
    {
      label: "Help me turn a fuzzy idea into something real",
      prompt:
        "I have a vague idea but nothing concrete. Help me describe it in plain language and see if it could become a real business.",
      icon: "lightbulb",
    },
    {
      label: "Turn this into a Lite Business Plan",
      prompt:
        "Here’s my current idea. Help me turn it into a short Lite Business Plan with audience, problem, offer, delivery, pricing, and a first experiment.",
      icon: "file-text",
    },
    {
      label: "I’m anxious about starting—keep it small and clear",
      prompt:
        "I’m anxious about starting anything. Help me find the smallest, clearest version of this idea and simple next steps.",
      icon: "face-smile",
    },
  ],

  // Product main
  product: [
    {
      label: "Help me define my offer",
      prompt:
        "I have a rough idea but not a clear offer. Help me turn it into something a specific person would understand and want to buy.",
      icon: "cube",
    },
    {
      label: "Narrow my niche",
      prompt:
        "I’m trying to sell to everyone. Help me choose a narrower, more realistic niche for this product or service.",
      icon: "bullseye",
    },
    {
      label: "I have too many ideas—pick one",
      prompt:
        "Here are a few product ideas I’m considering. Help me compare them and pick one to focus on first.",
      icon: "list-check",
    },
  ],

  // Marketing main
  marketing: [
    {
      label: "Who am I actually talking to?",
      prompt:
        "Here’s my business idea. Help me define a clear target customer I can picture and talk to directly.",
      icon: "user-group",
    },
    {
      label: "Help me write a simple pitch",
      prompt:
        "Help me write a one‑sentence pitch for my business that a friend would understand immediately.",
      icon: "message",
    },
    {
      label: "Choose 1–2 marketing channels",
      prompt:
        "Here’s my offer and who I think it’s for. Help me pick one or two realistic marketing channels to start with, and tell me why.",
      icon: "share-nodes",
    },
  ],

  // Finance main
  finance: [
    {
      label: "Sanity‑check my pricing",
      prompt:
        "Here’s what I’m planning to sell and what I was thinking of charging. Help me sanity‑check this pricing and suggest a simple starting point.",
      icon: "tag",
    },
    {
      label: "Can this realistically pay my bills?",
      prompt:
        "Here’s my business idea, my rough pricing, and how much I’d like to earn per month. Help me see if the numbers are realistic.",
      icon: "wallet",
    },
    {
      label: "I’m scared of the numbers—start small with me",
      prompt:
        "I’m intimidated by money and spreadsheets. Help me take the tiniest step to understand the basic numbers for this idea.",
      icon: "heart-crack",
    },
  ],

  // Business task – Reality Check
  reality_check: [
    {
      label: "Review my idea from scratch",
      prompt:
        "Here’s my business idea. Please give me a clear reality check on how feasible it looks, who might actually buy, and what worries you most.",
      icon: "clipboard-list",
    },
    {
      label: "Check the plan I already wrote",
      prompt:
        "I already have a simple business plan written. I’ll paste it—please review it and give me an honest reality check on feasibility and next steps.",
      icon: "file-text",
    },
    {
      label: "Is this realistic for one person?",
      prompt:
        "I’m one person with limited time and energy. Here’s my idea—tell me if this feels realistic for a solo founder, and what I might need to shrink or simplify.",
      icon: "user-clock",
    },
    {
      label: "What should I test in the next 30 days?",
      prompt:
        "Given this idea, what are the 3–5 most important things I should test in the next 30 days before committing more time and money?",
      icon: "calendar-days",
    },
  ],

  // Business task – SWOT Analysis
  swot: [
    {
      label: "Give me a full SWOT for my idea",
      prompt:
        "Here’s my business idea. Please create a clear SWOT analysis with strengths, weaknesses, opportunities, and threats, and then tell me what to lean into and what to watch.",
      icon: "chart-simple",
    },
    {
      label: "I’m not sure what my strengths are",
      prompt:
        "Here’s my background and my business idea. Help me identify my real strengths in this context and how they show up in a SWOT.",
      icon: "user",
    },
    {
      label: "Compare two directions",
      prompt:
        "I’m torn between two business ideas. Please create a brief SWOT for each and help me see which one looks more promising for the next 6–12 months.",
      icon: "shuffle",
    },
    {
      label: "Help me see the real risks",
      prompt:
        "Here’s my current plan. I want you to be honest about weaknesses and threats—what are the few things most likely to stall or derail this idea?",
      icon: "triangle-exclamation",
    },
  ],

  // Business task – Legal & Tax Checkup
  legal_tax: [
    {
      label: "Scan my plan for legal and tax issues",
      prompt:
        "Here’s my business idea and how I plan to run it. Please highlight the main legal and tax areas I should pay attention to, in simple language.",
      icon: "shield-halved",
    },
    {
      label: "I’ll work with clients in other countries",
      prompt:
        "I’m based in [your country] but I’ll be working with clients in other countries. Here’s my plan—what kinds of legal and tax questions should I ask a professional about cross‑border work?",
      icon: "globe",
    },
    {
      label: "I’m dealing with sensitive topics",
      prompt:
        "My business touches on health, mental health, finances, or children. Here’s what I’m planning to do. Please flag the higher‑risk areas I should definitely discuss with a lawyer or tax professional.",
      icon: "hand-holding-heart",
    },
    {
      label: "Prepare for a call with a pro",
      prompt:
        "Here’s my current plan and where I’m based. Help me turn this into a simple list of questions to bring to a small-business lawyer or accountant.",
      icon: "file-pen",
    },
  ],
};

// Helper to get starter prompts for a given agent.
export function getStarterPromptsForAgent(agent?: string): StartScreenPrompt[] {
  if (!agent) return STARTER_PROMPTS;
  return STARTER_PROMPTS_BY_AGENT[agent] ?? STARTER_PROMPTS;
}

// ---------- THEME CONFIG ----------

export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  color: {
    grayscale: {
      hue: 222,
      tint: 5,
      shade: theme === "dark" ? -1 : -4,
    },
    accent: {
      primary: theme === "dark" ? "#f1f5f9" : "#0f172a",
      level: 1,
    },
  },
  radius: "round",
});
