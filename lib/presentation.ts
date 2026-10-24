import type { Strategy } from "./schemas";
export const strategyLabels: Record<Strategy, string> = { llm: "LLM only", dm: "DM only", hybrid: "DM + LLM" };
export const percent = (n: number | null) => n === null ? "N/A" : `${(n * 100).toFixed(1)}%`;
export const usd = (n: number | null) => n === null ? "Unavailable" : `$${n.toFixed(6)}`;
