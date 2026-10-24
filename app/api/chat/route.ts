import { getLLM, model } from "../../../lib/llm";
import { providerError, withRateLimitRetry } from "../../../lib/retry";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("message" in body) ||
    typeof body.message !== "string" ||
    !body.message.trim()
  ) {
    return Response.json(
      { error: "Please provide a non-empty message string." },
      { status: 400 },
    );
  }

  const history = "history" in body ? body.history : [];

  if (
    !Array.isArray(history) ||
    !history.every(
      (m) =>
        m !== null &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
  ) {
    return Response.json({ error: "Invalid history." }, { status: 400 });
  }

  const message = body.message.trim();
  try {
    const { value: response } = await withRateLimitRetry(() => getLLM().chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a helpful support assistant." },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    }).catch(error => { throw providerError(error, "Chat"); }));
    const answer = response.choices[0]?.message.content;
    if (!answer?.trim()) return Response.json({ error: "The assistant returned an empty reply. Please try again." }, { status: 502 });
    return Response.json({ answer });
  } catch (error) {
    const failure = providerError(error, "Chat");
    return Response.json(
      { error: failure.message },
      { status: failure.status === 429 ? 429 : 502, headers: failure.retryAfter ? { "Retry-After": failure.retryAfter } : undefined },
    );
  }
}
