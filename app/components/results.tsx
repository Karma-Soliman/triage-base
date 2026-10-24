import type { TriageResult } from "../../lib/schemas";
import type { SmokeRun } from "../../lib/runs";
import { percent, strategyLabels, usd } from "../../lib/presentation";

export function Prediction({ result }: { result: TriageResult }) {
  return <>
    <p><strong>{result.prediction.category} · {result.prediction.priority}</strong> · Human review: {result.prediction.needs_human_review ? "yes" : "no"}</p>
    <p>{result.prediction.explanation}</p>
    <p>{strategyLabels[result.strategy ?? "llm"]} · {result.model} · {(result.latencyMs / 1000).toFixed(2)}s · {usd(result.costUsd)}</p>
    <p>Total tokens: {result.usage ? `input ${result.usage.input} · output ${result.usage.output} · total ${result.usage.total}` : "unavailable from provider"}</p>
    <details><summary>Model stages and DM confidence</summary>
      <p>Output token counts include reasoning tokens when the provider includes them in its total.</p>
      {(result.stages ?? []).map((stage, i) => <div key={i}>
        <p><strong>{stage.provider.toUpperCase()}: {stage.model}</strong><br />
          {stage.prediction?.category} · {stage.prediction?.priority} · {(stage.latencyMs / 1000).toFixed(2)}s · {stage.retries} retries · {usd(stage.costUsd)}<br />
          Tokens: {stage.usage ? `input ${stage.usage.input} · output ${stage.usage.output} · total ${stage.usage.total}` : "unavailable"}
        </p>
      </div>)}
      {result.dm && <>
        <p>DM confidence: category {percent(result.dm.categoryConfidence)} · priority {percent(result.dm.priorityConfidence)}<br />
          Human review probability: {percent(result.dm.reviewProbability)} · Expected priority score: {result.dm.priorityScore.toFixed(2)} / 2</p>
        <p>Category probabilities: {Object.entries(result.dm.categoryProbabilities).map(([k, v]) => `${k}: ${percent(v)}`).join(" · ")}</p>
        <p>Priority probabilities: {Object.entries(result.dm.priorityProbabilities).map(([k, v]) => `${k}: ${percent(v)}`).join(" · ")}</p>
        {result.strategy === "hybrid" && <p>The DM confidence belongs to the preliminary DM prediction, not the final LLM review.</p>}
      </>}
    </details>
  </>;
}

export function RunTable({ runs }: { runs: SmokeRun[] }) {
  return <div className="table-scroll"><table>
    <thead><tr><th>Strategy / sample</th><th>Model(s)</th><th>Accuracy: category / priority</th><th>Outcomes</th><th>Latency: total / per sampled ticket</th><th>Tokens: in / out / total</th><th>Cost / retries</th></tr></thead>
    <tbody>{runs.map(run => <tr key={run.id}>
      <td>{strategyLabels[run.strategy ?? "llm"]}<br />{run.dataset} · {run.sampleSize} tickets<br /><small>Seed: {run.sampleSeed ?? "legacy random sample"}</small></td>
      <td>{run.model}<br /><small>Observed: {run.modelsUsed?.join(", ") || run.model}</small></td>
      <td>{percent(run.categoryAccuracy)} / {percent(run.priorityAccuracy)}<br /><small>Mismatches: {run.categoryMismatches ?? "N/A"} / {run.priorityMismatches ?? "N/A"}</small></td>
      <td>{run.succeeded} succeeded · {run.failed} failed<br />{run.humanReview} human review</td>
      <td>{(run.latencyMs / 1000).toFixed(2)}s / {(run.averageLatencyMs / 1000).toFixed(2)}s</td>
      <td>{run.usage.input} / {run.usage.output} / {run.usage.total}{!run.usageComplete && <><br /><small>Partial usage; some calls failed or omitted usage</small></>}</td>
      <td>{usd(run.costUsd)}<br />{run.retries ?? 0} retries</td>
    </tr>)}</tbody>
  </table></div>;
}

export function RunResults({ run }: { run: SmokeRun }) {
  return <>
    <h3>{strategyLabels[run.strategy ?? "llm"]}: ticket results</h3>
    {run.tickets.map(ticket => <article className="message" key={ticket.ticketId}>
      <strong>{ticket.ticketId}: {ticket.subject || "(no subject)"}</strong>
      {ticket.expected && <p>Labelled: {ticket.expected.category} · {ticket.expected.priority}</p>}
      {ticket.result && <><p>Predicted:</p><Prediction result={ticket.result} />
        {ticket.expected && <p>Category: {ticket.expected.category === ticket.result.prediction.category ? "match" : "mismatch"} · Priority: {ticket.expected.priority === ticket.result.prediction.priority ? "match" : "mismatch"}</p>}
      </>}
      {ticket.error && <><p role="alert">{ticket.error}</p>{ticket.stages?.map((s, i) => <p key={i}>{s.provider.toUpperCase()} stage: {s.model} · {s.retries} retries · Tokens: {s.usage?.total ?? "unknown"}</p>)}</>}
    </article>)}
    <h3>Summary</h3><p>{run.succeeded} succeeded · {run.failed} failed · {run.humanReview} need human review.</p>
    {run.categoryMismatches !== null && <p>Category mismatches: {run.categoryMismatches} · Priority mismatches: {run.priorityMismatches}. Accuracy uses {run.succeeded} successful predictions; failed or unattempted tickets are excluded.</p>}
  </>;
}
