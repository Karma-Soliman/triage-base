import { randomInt, randomUUID } from "node:crypto";
import labelled from "../../../data/support_tickets_100_labelled.json";
import unlabelled from "../../../data/support_tickets_500.json";
import { smokeRequestSchema, validationMessage } from "../../../lib/schemas";
import { triage, TriageError } from "../../../lib/triage";
import { model } from "../../../lib/llm";
import { saveRun, type SmokeRun } from "../../../lib/runs";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = smokeRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: validationMessage(parsed.error) }, { status: 400 });
  const { dataset, sampleSize } = parsed.data;
  const pool = [...(dataset === "labelled100" ? labelled : unlabelled)];
  for (let i = pool.length - 1; i > 0; i--) { const j = randomInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const started = Date.now();
  const run: SmokeRun = { id: randomUUID(), createdAt: new Date().toISOString(), dataset, sampleSize, model, succeeded: 0, failed: 0, humanReview: 0, categoryMismatches: dataset === "labelled100" ? 0 : null, priorityMismatches: dataset === "labelled100" ? 0 : null, categoryAccuracy: null, priorityAccuracy: null, latencyMs: 0, averageLatencyMs: 0, costUsd: 0, usage: { input: 0, output: 0, total: 0 }, usageComplete: true, categoryCounts: {}, priorityCounts: {}, tickets: [] };
  let callLatency = 0;
  for (const ticket of pool.slice(0, sampleSize)) {
    const expected = dataset === "labelled100" && "category" in ticket && "priority" in ticket ? { category: String(ticket.category), priority: String(ticket.priority) } : null;
    const outcome: SmokeRun["tickets"][number] = { ticketId: ticket.ticket_id, subject: ticket.subject, expected, result: null, error: null };
    const callStarted = Date.now();
    let usage = null, costUsd: number | null = null;
    try {
      const result = await triage({ subject: ticket.subject, body: ticket.body });
      outcome.result = result; usage = result.usage; costUsd = result.costUsd;
      run.model = result.model; run.succeeded++;
      const p = result.prediction;
      run.humanReview += Number(p.needs_human_review);
      run.categoryCounts[p.category] = (run.categoryCounts[p.category] || 0) + 1;
      run.priorityCounts[p.priority] = (run.priorityCounts[p.priority] || 0) + 1;
      if (expected) { run.categoryMismatches! += Number(p.category !== expected.category); run.priorityMismatches! += Number(p.priority !== expected.priority); }
    } catch (error) {
      outcome.error = error instanceof TriageError ? error.message : "LLM call failed. Check configuration or retry.";
      if (error instanceof TriageError) { usage = error.usage; costUsd = error.costUsd; }
      run.failed++;
    }
    callLatency += Date.now() - callStarted;
    if (usage) { run.usage.input += usage.input; run.usage.output += usage.output; run.usage.total += usage.total; } else run.usageComplete = false;
    run.costUsd = run.costUsd === null || costUsd === null ? null : run.costUsd + costUsd;
    run.tickets.push(outcome);
  }
  run.latencyMs = Date.now() - started;
  run.averageLatencyMs = callLatency / sampleSize;
  if (dataset === "labelled100" && run.succeeded) { run.categoryAccuracy = (run.succeeded - run.categoryMismatches!) / run.succeeded; run.priorityAccuracy = (run.succeeded - run.priorityMismatches!) / run.succeeded; }
  try { await saveRun(run); } catch { return Response.json({ error: "The run finished, but its log could not be saved. Check data directory permissions.", run }, { status: 500 }); }
  return Response.json(run);
}
