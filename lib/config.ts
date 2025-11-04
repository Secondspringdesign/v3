// lib/config.ts
import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

// Default starter prompts (global)
export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "What can you do?",
    prompt: "What can you do?",
    icon: "circle-question",
  },
];

// Optional: per-agent starter prompts (fallback to STARTER_PROMPTS if not provided)
export const STARTER_PROMPTS_BY_AGENT: Record<string, StartScreenPrompt[]> = {
  strategy: [
    { label: "New business vs. existing problem", prompt: "Are we creating a new business (from idea to launch), or solving a problem in your current business?", icon: "lightning" },
    // add more strategy-specific prompts...
  ],
  product: [
    { label: "Product discovery", prompt: "I need help with product discovery and prioritization.", icon: "sparkles" },
  ],
  marketing: [
    { label: "Go-to-market", prompt: "Help me define a go-to-market plan and positioning.", icon: "megaphone" },
  ],
  operations: [
    { label: "Ops improvements", prompt: "Optimize my operational workflows and tooling.", icon: "gear" },
  ],
};

// Global fallback placeholder
export const PLACEHOLDER_INPUT = "Ask anything...";

// Global fallback greeting (keeps backward compatibility)
export const GREETING = "How can I help you today?";

// Per-agent greetings (customize these as you want)
export const GREETINGS: Record<string, string> = {
  strategy: "Are we creating a new business (from idea to launch), or solving a problem in your current business?",
  product: "Tell me about the product challenge — new feature, roadmap, or usability?",
  marketing: "Are you launching a campaign, defining positioning, or researching channels?",
  operations: "What operational process do you want to improve: finance, hiring, or tooling?",
};

// Helper to get a greeting for a given agent (falls back to global GREETING)
export function getGreetingForAgent(agent?: string) {
  if (!agent) return GREETING;
  return GREETINGS[agent] ?? GREETING;
}

// Helper to get starter prompts for a given agent (falls back to STARTER_PROMPTS)
export function getStarterPromptsForAgent(agent?: string): StartScreenPrompt[] {
  if (!agent) return STARTER_PROMPTS;
  return STARTER_PROMPTS_BY_AGENT[agent] ?? STARTER_PROMPTS;
}

export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  color: {
    grayscale: {
      hue: 220,
      tint: 6,
      shade: theme === "dark" ? -1 : -4,
    },
    accent: {
      primary: theme === "dark" ? "#f1f5f9" : "#0f172a",
      level: 1,
    },
  },
  radius: "round",
});
