import { triage } from "../../../lib/triage";
import { triageRequestSchema, validationMessage } from "../../../lib/schemas";
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = triageRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: validationMessage(parsed.error) }, { status: 400 });
  try { return Response.json(await triage(parsed.data)); }
  catch { return Response.json({ error: "Unable to triage this ticket. Check LLM configuration or try again; the provider may have returned an invalid response." }, { status: 502 }); }
}
