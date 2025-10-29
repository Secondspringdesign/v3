// lib/config.ts
import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

/* ------------------------------------------------------------------ */
/* 1. WORKFLOW IDs – read from Vercel public env vars                 */
/* ------------------------------------------------------------------ */
const WORKFLOWS = {
  strategy:   process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_STRATEGY?.trim()   ?? "",
  operations: process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_OPERATIONS?.trim() ?? "",
  marketing:  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_MARKETING?.trim()  ?? "",
  product:    process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_PRODUCT?.trim()    ?? "",
};

/* Keep the original default (Strategy) – used when no ?agent= is passed */
export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? WORKFLOWS.strategy;

/* Export the map so the API route can pick the right ID */
export { WORKFLOWS };

/* ------------------------------------------------------------------ */
/* 2. Everything else – unchanged                                      */
/* ------------------------------------------------------------------ */
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
