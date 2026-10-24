import { createHash, randomUUID } from "node:crypto";
import labelled from "../../../data/support_tickets_100_labelled.json";
import unlabelled from "../../../data/support_tickets_500.json";
import { smokeRequestSchema, validationMessage } from "../../../lib/schemas";
import { configuredModels, triage, TriageError } from "../../../lib/triage";
import { saveRun, type SmokeRun } from "../../../lib/runs";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = smokeRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: validationMessage(parsed.error) }, { status: 400 });
  const { dataset, sampleSize, strategy } = parsed.data;
  const sampleSeed = parsed.data.sampleSeed || randomUUID();
  // Hash ranking is deterministic for the same seed and dataset, with no duplicate tickets.
  const pool = [...(dataset === "labelled100" ? labelled : unlabelled)]
    .map(ticket => ({ ticket, rank: createHash("sha256").update(`${sampleSeed}\0${dataset}\0${ticket.ticket_id}`).digest("hex") }))
    .sort((a, b) => a.rank.localeCompare(b.rank)).slice(0, sampleSize).map(entry => entry.ticket);
  const started = Date.now();
  const run: SmokeRun = {
    id: randomUUID(), createdAt: new Date().toISOString(), dataset, sampleSize, strategy, sampleSeed,
    model: configuredModels(strategy), modelsUsed: [], retries: 0,
    succeeded: 0, failed: 0, humanReview: 0,
    categoryMismatches: dataset === "labelled100" ? 0 : null,
    priorityMismatches: dataset === "labelled100" ? 0 : null,
    categoryAccuracy: null, priorityAccuracy: null, latencyMs: 0, averageLatencyMs: 0,
    costUsd: 0, usage: { input: 0, output: 0, total: 0 }, usageComplete: true,
    categoryCounts: {}, priorityCounts: {}, tickets: [],
  };
  let terminalFailure: TriageError | null = null;
  for (const ticket of pool) {
    const expected = dataset === "labelled100" && "category" in ticket && "priority" in ticket
      ? { category: String(ticket.category), priority: String(ticket.priority) } : null;
    const outcome: SmokeRun["tickets"][number] = { ticketId: ticket.ticket_id, subject: ticket.subject, expected, result: null, error: null };
    try {
      // Once credentials/quota fail or a retry budget is exhausted, do not hammer the API for the rest of the sample.
      if (terminalFailure) throw new TriageError(`Not attempted: ${terminalFailure.message}`, [], terminalFailure.status, terminalFailure.code, terminalFailure.retryAfter);
      const result = await triage({ subject: ticket.subject, body: ticket.body, strategy });
      outcome.result = result;
      outcome.stages = result.stages;
      run.model = result.model;
      run.succeeded++;
      const p = result.prediction;
      run.humanReview += Number(p.needs_human_review);
      run.categoryCounts[p.category] = (run.categoryCounts[p.category] || 0) + 1;
      run.priorityCounts[p.priority] = (run.priorityCounts[p.priority] || 0) + 1;
      if (expected) {
        run.categoryMismatches! += Number(p.category !== expected.category);
        run.priorityMismatches! += Number(p.priority !== expected.priority);
      }
    } catch (error) {
      const failure = error instanceof TriageError ? error : new TriageError("Inference failed. Check configuration or retry.");
      outcome.error = failure.message;
      outcome.errorCode = failure.code;
      outcome.retryAfter = failure.retryAfter;
      outcome.stages = failure.stages;
      run.failed++;
      if (!terminalFailure && (failure.status === 429 || failure.status === 401 || failure.status === 403 || failure.code === "configuration_error")) terminalFailure = failure;
    }
    const stages = outcome.stages ?? [];
    if (!outcome.result) run.usageComplete = false;
    for (const stage of stages) {
      run.retries! += stage.retries;
      if (!run.modelsUsed!.includes(stage.model)) run.modelsUsed!.push(stage.model);
      if (stage.usage) {
        run.usage.input += stage.usage.input; run.usage.output += stage.usage.output; run.usage.total += stage.usage.total;
      } else run.usageComplete = false;
      run.costUsd = run.costUsd === null || stage.costUsd === null ? null : run.costUsd + stage.costUsd;
    }
    run.tickets.push(outcome);
  }
  run.latencyMs = Date.now() - started;
  run.averageLatencyMs = run.latencyMs / sampleSize;
  if (dataset === "labelled100" && run.succeeded) {
    run.categoryAccuracy = (run.succeeded - run.categoryMismatches!) / run.succeeded;
    run.priorityAccuracy = (run.succeeded - run.priorityMismatches!) / run.succeeded;
  }
  try { await saveRun(run); }
  catch { return Response.json({ error: "The run finished, but its log could not be saved. Check data directory permissions.", run }, { status: 500 }); }
  return Response.json(run);
}
