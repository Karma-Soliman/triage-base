import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { TriageResult } from "./schemas";
export type TicketOutcome = { ticketId: string; subject: string; expected: { category: string; priority: string } | null; result: TriageResult | null; error: string | null };
export type SmokeRun = {
  id: string; createdAt: string; dataset: string; sampleSize: number; model: string;
  succeeded: number; failed: number; humanReview: number;
  categoryMismatches: number | null; priorityMismatches: number | null;
  categoryAccuracy: number | null; priorityAccuracy: number | null;
  latencyMs: number; averageLatencyMs: number; costUsd: number | null;
  usage: { input: number; output: number; total: number }; usageComplete: boolean;
  categoryCounts: Record<string, number>; priorityCounts: Record<string, number>; tickets: TicketOutcome[];
};
const logPath = path.join(process.cwd(), "data", "smoke-runs.jsonl");
export async function saveRun(run: SmokeRun) {
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, JSON.stringify(run) + "\n", "utf8");
}
export async function readRuns(): Promise<SmokeRun[]> {
  try { return (await readFile(logPath, "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line) as SmokeRun).reverse(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
