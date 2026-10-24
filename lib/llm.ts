import OpenAI from "openai";

let client: OpenAI | undefined;
export function getLLM() {
  if (!process.env.LLM_API_KEY) throw new Error("LLM_API_KEY is not configured.");
  client ??= new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL, maxRetries: 0, timeout: 60000 });
  return client;
}
export const model = process.env.LLM_MODEL || "";
