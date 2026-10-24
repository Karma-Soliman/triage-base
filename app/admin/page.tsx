import { readRuns } from "../../lib/runs";
import { RunResults, RunTable } from "../components/results";
import { strategyLabels } from "../../lib/presentation";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const runs = await readRuns();
  return <main className="admin"><h1>Smoke test history</h1>
    <p>Compare runs with the same dataset, sample size and seed. Accuracy uses successful labelled predictions; check failures as well. DM calls use the free hosted API. LLM costs require configured model rates.</p>
    {!runs.length ? <p>No logged runs yet.</p> : <>
      <RunTable runs={runs} />
      <h2>Run details</h2>
      {runs.map(run => <details key={run.id}><summary>{run.createdAt} · {strategyLabels[run.strategy ?? "llm"]} · {run.id}</summary>
        <p>Category counts: {JSON.stringify(run.categoryCounts)}<br />Priority counts: {JSON.stringify(run.priorityCounts)}</p>
        <RunResults run={run} />
      </details>)}
    </>}
  </main>;
}
