"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { triageRequestSchema, triageResponseSchema, validationMessage, type TriageResult } from "../lib/schemas";
import type { SmokeRun } from "../lib/runs";

function Tokens({ result }: { result: TriageResult }) {
  return <p>Tokens: {result.usage ? `input ${result.usage.input} · output ${result.usage.output} · total ${result.usage.total}` : "unavailable from provider"}</p>;
}
function Prediction({ result }: { result: TriageResult }) {
  return <><p><strong>{result.prediction.category} · {result.prediction.priority}</strong> · Human review: {result.prediction.needs_human_review ? "yes" : "no"}</p><p>{result.prediction.explanation}</p><Tokens result={result} /></>;
}
export default function TriagePage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [dataset, setDataset] = useState("labelled100");
  const [sampleSize, setSampleSize] = useState(5);
  const [run, setRun] = useState<SmokeRun | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent, smoke: boolean) {
    event.preventDefault(); setError(null);
    if (!smoke) {
      const parsed = triageRequestSchema.safeParse({ subject, body });
      if (!parsed.success) { setError(validationMessage(parsed.error)); return; }
    }
    setBusy(smoke ? "smoke" : "triage");
    if (smoke) setRun(null); else setResult(null);
    try {
      const response = await fetch(smoke ? "/api/smoke" : "/api/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(smoke ? { dataset, sampleSize } : { subject, body }) });
      const data = await response.json();
      if (!response.ok) { if (smoke && data.run) setRun(data.run); throw new Error(data.error || "Request failed."); }
      if (smoke) setRun(data as SmokeRun);
      else { const parsed = triageResponseSchema.safeParse(data); if (!parsed.success) throw new Error("The server returned an invalid triage result."); setResult(parsed.data); }
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed."); }
    finally { setBusy(null); }
  }
  return <main className="chat">
    <nav><Link href="/admin">Admin: smoke test history →</Link></nav>
    <h1>Support ticket triage</h1>
    <section className="panel"><h2>Triage a ticket</h2>
      <form onSubmit={e => submit(e, false)} aria-busy={busy === "triage"}>
        <label htmlFor="subject">Subject</label><input id="subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={500} />
        <label htmlFor="body">Ticket description</label><textarea id="body" rows={5} value={body} onChange={e => setBody(e.target.value)} maxLength={20000} />
        <button disabled={!!busy}>{busy === "triage" ? "Triaging…" : "Triage ticket"}</button>
      </form>
      {result && <article aria-live="polite"><Prediction result={result} /></article>}
    </section>
    <section className="panel"><h2>Smoke test</h2><p>Random sample without replacement. Each selected ticket makes one LLM call.</p>
      <form onSubmit={e => submit(e, true)} aria-busy={busy === "smoke"}>
        <label htmlFor="dataset">Dataset</label><select id="dataset" value={dataset} disabled={!!busy} onChange={e => { setDataset(e.target.value); setSampleSize(n => Math.min(n, e.target.value === "labelled100" ? 100 : 500)); }}><option value="labelled100">100 labelled tickets</option><option value="tickets500">500 unlabelled tickets</option></select>
        <label htmlFor="sample">Tickets to sample</label><input id="sample" type="number" required min={1} max={dataset === "labelled100" ? 100 : 500} value={sampleSize} disabled={!!busy} onChange={e => setSampleSize(Number(e.target.value))} />
        <button disabled={!!busy}>{busy === "smoke" ? "Running smoke test…" : "Run smoke test"}</button>
      </form>
      {busy === "smoke" && <p role="status">Running selected tickets. Larger samples may take several minutes.</p>}
      {run && <div aria-live="polite"><h3>Results</h3>{run.tickets.map(ticket => <article className="message" key={ticket.ticketId}><strong>{ticket.ticketId}: {ticket.subject || "(no subject)"}</strong>{ticket.expected && <p>Labelled: {ticket.expected.category} · {ticket.expected.priority}</p>}{ticket.result && <><p>Predicted:</p><Prediction result={ticket.result} />{ticket.expected && <p>Category: {ticket.expected.category === ticket.result.prediction.category ? "match" : "mismatch"} · Priority: {ticket.expected.priority === ticket.result.prediction.priority ? "match" : "mismatch"}</p>}</>}{ticket.error && <p role="alert">{ticket.error}</p>}</article>)}
        <h3>Summary</h3><p>{run.succeeded} succeeded · {run.failed} failed · {run.humanReview} need human review</p>
        {run.categoryMismatches !== null && <p>Category mismatches: {run.categoryMismatches} · Priority mismatches: {run.priorityMismatches} (among {run.succeeded} successful predictions; failed calls excluded).</p>}
        <p>Duration: {(run.latencyMs / 1000).toFixed(1)}s · Estimated cost: {run.costUsd === null ? "unavailable" : `$${run.costUsd.toFixed(6)}`} · Model: {run.model}</p>
      </div>}
    </section>
    {error && <p role="alert">{error}</p>}
  </main>;
}
