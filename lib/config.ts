import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const WORKFLOWS = {
  strategy: process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_STRATEGY?.trim() || '',
  operations: process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_OPERATIONS?.trim() || '',
  marketing: process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_MARKETING?.trim() || '',
  product: process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_PRODUCT?.trim() || '',
};

// Default to strategy if no agent is passed
export const WORKFLOW_ID = WORKFLOWS.strategy;

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "What can you do?",
    prompt: "What can you do?",
    icon: "circle-question",
  },
];

export const PLACEHOLDER_INPUT = "Ask anything...";

export const GREETING = "How can I help you today?";

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
