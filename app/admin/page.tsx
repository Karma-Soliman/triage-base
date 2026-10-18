import Link from "next/link";
import { readRuns } from "../../lib/runs";
export const dynamic = "force-dynamic";
const accuracy = (n: number | null) => n === null ? "N/A" : `${(n * 100).toFixed(1)}%`;
export default async function AdminPage() {
  const runs = await readRuns();
  return <main className="admin"><Link href="/">← Triage</Link><h1>Smoke test history</h1><p>Accuracy uses successful labelled predictions. Failed calls are listed separately. Costs are estimates from configured model rates.</p>
    {!runs.length ? <p>No logged runs yet.</p> : <div className="table-scroll"><table><thead><tr><th>Run / UTC date</th><th>Dataset / sample</th><th>Model</th><th>Accuracy (category / priority)</th><th>Outcomes</th><th>Category / priority counts</th><th>Latency (total / average)</th><th>Estimated cost (USD)</th></tr></thead><tbody>{runs.map(run => <tr key={run.id}>
      <td>{run.createdAt}<br /><small>{run.id}</small></td><td>{run.dataset}<br />{run.sampleSize} tickets</td><td>{run.model}</td><td>{accuracy(run.categoryAccuracy)} / {accuracy(run.priorityAccuracy)}<br />Mismatches: {run.categoryMismatches ?? "N/A"} / {run.priorityMismatches ?? "N/A"}</td><td>{run.succeeded} succeeded<br />{run.failed} failed<br />{run.humanReview} human review</td><td>{JSON.stringify(run.categoryCounts)}<br />{JSON.stringify(run.priorityCounts)}</td><td>{(run.latencyMs / 1000).toFixed(2)}s / {(run.averageLatencyMs / 1000).toFixed(2)}s</td><td>{run.costUsd === null ? "Unavailable" : `$${run.costUsd.toFixed(6)}`}</td>
    </tr>)}</tbody></table></div>}
  </main>;
}
