import { llm, model } from "../../../lib/llm";

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

  try {
    const response = await llm.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a helpful support assistant." },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: body.message.trim() },
      ],
    });

    return Response.json({
      answer: response.choices[0]?.message.content ?? "",
    });
  } catch {
    return Response.json(
      { error: "Cannot generate an answer." },
      { status: 502 },
    );
  }
}
