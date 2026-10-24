"use client";
import { useState, type FormEvent } from "react";
import { smokeRequestSchema, triageRequestSchema, triageResponseSchema, validationMessage, type Strategy, type TriageResult } from "../lib/schemas";
import type { SmokeRun } from "../lib/runs";
import { strategyLabels } from "../lib/presentation";
import { Prediction, RunResults, RunTable } from "./components/results";

function StrategySelect({ id, value, onChange, disabled }: { id: string; value: Strategy; onChange: (value: Strategy) => void; disabled: boolean }) {
  return <><label htmlFor={id}>Inference strategy</label><select id={id} value={value} disabled={disabled} onChange={e => onChange(e.target.value as Strategy)}>
    {Object.entries(strategyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
  </select></>;
}
export default function TriagePage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("llm");
  const [smokeStrategy, setSmokeStrategy] = useState<Strategy>("llm");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [dataset, setDataset] = useState("labelled100");
  const [sampleSize, setSampleSize] = useState(5);
  const [sampleSeed, setSampleSeed] = useState("");
  const [runs, setRuns] = useState<SmokeRun[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitTicket(event: FormEvent) {
    event.preventDefault(); setError(null);
    const parsed = triageRequestSchema.safeParse({ subject, body, strategy });
    if (!parsed.success) { setError(validationMessage(parsed.error)); return; }
    setBusy("Triaging ticket…"); setResult(null);
    try {
      const response = await fetch("/api/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Triage failed.");
      const validated = triageResponseSchema.safeParse(data);
      if (!validated.success) throw new Error("The server returned an invalid triage result.");
      setResult(validated.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed."); }
    finally { setBusy(null); }
  }

  async function runSmoke(compare: boolean) {
    setError(null);
    const seed = sampleSeed.trim() || crypto.randomUUID();
    const parsed = smokeRequestSchema.safeParse({ dataset, sampleSize, strategy: smokeStrategy, sampleSeed: seed });
    if (!parsed.success) { setError(validationMessage(parsed.error)); return; }
    setSampleSeed(seed);
    const strategies: Strategy[] = compare ? ["llm", "dm", "hybrid"] : [smokeStrategy];
    try {
      for (const selected of strategies) {
        setBusy(`Running ${strategyLabels[selected]} on ${sampleSize} tickets…`);
        const response = await fetch("/api/smoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...parsed.data, strategy: selected }) });
        const data = await response.json();
        if (data.run) setRuns(previous => [...previous, data.run]);
        if (!response.ok) throw new Error(data.error || "Smoke test failed.");
        setRuns(previous => [...previous, data as SmokeRun]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed."); }
    finally { setBusy(null); }
  }

  return <main className="chat">
    <h1>Support ticket triage</h1>
    <section className="panel"><h2>Triage a ticket</h2>
      <form onSubmit={submitTicket} aria-busy={!!busy}>
        <StrategySelect id="strategy" value={strategy} onChange={setStrategy} disabled={!!busy} />
        <label htmlFor="subject">Subject</label><input id="subject" value={subject} disabled={!!busy} onChange={e => setSubject(e.target.value)} maxLength={500} />
        <label htmlFor="body">Ticket description</label><textarea id="body" rows={5} value={body} disabled={!!busy} onChange={e => setBody(e.target.value)} maxLength={20000} />
        <button disabled={!!busy}>Triage ticket</button>
      </form>
      {result && <article aria-live="polite"><Prediction result={result} /></article>}
    </section>
    <section className="panel"><h2>Smoke test</h2>
      <p>Random sample without replacement. Reuse the sample seed to compare strategies on exactly the same tickets. Hybrid runs a DM call followed by an LLM review for each ticket.</p>
      <form onSubmit={e => { e.preventDefault(); void runSmoke(false); }} aria-busy={!!busy}>
        <StrategySelect id="smoke-strategy" value={smokeStrategy} onChange={setSmokeStrategy} disabled={!!busy} />
        <label htmlFor="dataset">Dataset</label><select id="dataset" value={dataset} disabled={!!busy} onChange={e => { setDataset(e.target.value); setSampleSize(n => Math.min(n, e.target.value === "labelled100" ? 100 : 500)); setSampleSeed(""); setRuns([]); }}><option value="labelled100">100 labelled tickets</option><option value="tickets500">500 unlabelled tickets</option></select>
        <label htmlFor="sample">Tickets to sample</label><input id="sample" type="number" required min={1} max={dataset === "labelled100" ? 100 : 500} value={sampleSize} disabled={!!busy} onChange={e => { setSampleSize(Number(e.target.value)); setRuns([]); }} />
        <label htmlFor="seed">Sample seed (blank creates a random sample)</label><input id="seed" value={sampleSeed} maxLength={100} disabled={!!busy} onChange={e => { setSampleSeed(e.target.value); setRuns([]); }} />
        <div className="actions">
          <button type="button" disabled={!!busy} onClick={() => { setSampleSeed(""); setRuns([]); }}>New random sample</button>
          <button disabled={!!busy}>Run selected strategy</button>
          <button type="button" disabled={!!busy} onClick={() => void runSmoke(true)}>Compare all three</button>
        </div>
      </form>
      {!!runs.length && <div aria-live="polite"><h3>Strategy comparison</h3><p>Accuracy excludes failed calls; check outcome counts before comparing. Logs retain the sample seed and ticket IDs.</p><RunTable runs={runs} />{runs.map(run => <details key={run.id}><summary>{strategyLabels[run.strategy ?? "llm"]} · {run.createdAt} · ticket details</summary><RunResults run={run} /></details>)}</div>}
    </section>
    {busy && <p role="status">{busy} Larger samples and rate-limit retries may take several minutes.</p>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
