import { triage, TriageError } from "../../../lib/triage";
import { triageRequestSchema, validationMessage } from "../../../lib/schemas";
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = triageRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: validationMessage(parsed.error) }, { status: 400 });
  try { return Response.json(await triage(parsed.data)); }
  catch (error) {
    const failure = error instanceof TriageError ? error : new TriageError("Unable to triage this ticket. Check configuration or retry.");
    return Response.json({ error: failure.message, code: failure.code, stages: failure.stages }, {
      status: failure.status === 429 ? 429 : 502,
      headers: failure.retryAfter ? { "Retry-After": failure.retryAfter } : undefined,
    });
  }
}
