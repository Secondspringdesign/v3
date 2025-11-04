import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const WORKFLOW_ID = process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() || '';

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "What can you do?",
    prompt: "What can you do?",
    icon: "circle-question",
  },
];

export const PLACEHOLDER_INPUT = "Ask anything...";

// Explicit greetings per workflow ID — no fallback
export const GREETINGS = {
  strategy: "I'm your Business Builder AI.\n\nAre we creating a new business (from idea to launch), or solving a problem in your current business?",
  product: "I'm your Product Builder AI.\n\nLet's build your MVP — what features are essential?",
  marketing: "I'm your Marketing AI.\n\nLet's get your first customers — who is your ideal buyer?",
  operations: "I'm your Operations AI.\n\nLet's optimize your business — what's your biggest bottleneck?",
};

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
