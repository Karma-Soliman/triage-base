# Support ticket triage

Requires Node.js 22 or newer. Run `npm install`, copy `.env.example` to `.env`,
configure the API keys, then run `npm run dev` (port 3033). Do not overwrite
an existing `.env` or put real keys in `.env.example`.

```env
LLM_API_KEY=your_llm_key
LLM_MODEL=your_llm_model
LLM_BASE_URL=your_provider_base_url
DECISION_API_KEY=your_decision_key
# Both optional; these are the defaults:
DECISION_MODEL=vllm-sr/d3-flash
DECISION_BASE_URL=https://decision.vllm-sr.ai
```

Quotes around `.env` values are optional. DM-only requires only the Decision
API key. LLM-only and hybrid require an LLM provider supporting strict JSON
schema chat completions. Hybrid requires both services.

## Chat

Use **Chat** in the navigation (or open `/chat`) for a conversation with the LLM.
Every message includes prior user and assistant messages, so the assistant can
remember earlier turns. Clear conversation starts fresh. History is kept in
page memory and resets if you leave or reload the page. Errors preserve the
conversation and unsent text so you can retry.

## Strategies

- **LLM only:** classify the original ticket with the configured LLM.
- **DM only:** Decision 3.0 answers category (`choice`), priority (`score`) and
  human-review (`noul`) questions. Priority uses the most probable level;
  human review uses a 0.5 probability threshold. Probability distributions,
  provider confidence and expected priority score are available in result details.
- **DM + LLM:** DM predicts first. The LLM sees the original ticket and all DM
  predictions/probabilities, then keeps or revises them. The final answer passes
  Zod validation. Both stages and combined tokens/cost are recorded. DM confidence
  describes the preliminary decision, not the final reviewed answer.

Request and response JSON schemas are generated from shared Zod definitions
in `lib/schemas.ts`. Invalid requests, incomplete DM answers and invalid LLM
outputs produce visible errors. Hybrid never silently falls back to one model.

## Smoke tests and history

Start a smoke test from the home page with either dataset, sample size and
strategy. A blank seed creates a random sample; reuse the seed, dataset and
sample size to select the same tickets. **Compare all three** runs the existing
runner once for each strategy with identical sampled ticket IDs. Labelled tests
show expected and predicted category/priority plus mismatch totals.

Every completed run (including failures) is appended to
`data/smoke-runs.jsonl`. `/admin` reads this history on every visit and lists
strategy, models, accuracy, outcome counts, total/average latency, tokens,
estimated cost and retries. Expand a run to inspect counts, per-ticket outputs,
probabilities and hybrid stages. Existing LLM-only logs remain readable.
Accuracy excludes failed/unattempted tickets; always compare coverage too.
Average latency divides wall time, including retries, by all sampled tickets.

Set `LLM_INPUT_USD_PER_MILLION` and `LLM_OUTPUT_USD_PER_MILLION` to the correct
rates for your configured LLM to enable estimated USD costs. Without both rates,
LLM and hybrid costs are unavailable. DM calls to the selected free hosted
service have $0 monetary cost. Missing token usage is shown as unavailable;
known partial usage is retained for failed hybrid calls. Output token counts include
reasoning tokens when those are included in the provider's reported total.
Usage reflects returned counts; timed-out calls may consume unreported tokens.

HTTP 429, 502 and 503 responses get at most three retries with exponential
backoff/jitter (starting at 10 seconds for 429 without a valid retry header). `Retry-After` (seconds or HTTP date) is respected. Retry waits
have a 90-second cumulative budget; longer requested waits fail rather than
retrying early. Daily quotas are not retried. The runner stops further calls
in a sample after quota/authentication failures or exhausted rate limits and
records the remaining tickets as unattempted failures.

This local implementation requires a persistent writable `data` directory.
`/admin` has no authentication. Calls run sequentially, so hosting request
timeouts must accommodate your sample and possible retries. Keys stay server-side.
The hosted Decision API may log submitted data; use the supplied synthetic
examples for coursework evaluation.

## Evaluation and report

The optional `tests/` and `scripts/` directories stay local and are ignored by Git.
Their npm commands are preserved under `_disabledScripts` in `package.json`,
which does not support comments. The app and frontend smoke tests work without
these tools. The commands below apply only when the local files are present.

```sh
node scripts/evaluate.cjs 10                # Real APIs; may incur LLM costs
node scripts/evaluate.cjs 10 my-sample-seed # Reproduce ticket selection
node scripts/evaluate.cjs --retry-failed    # Rerun failed strategies on saved sample
node scripts/evaluate.cjs --report-only                       # Reuse saved evidence; no API calls
```

The evaluation command uses the same smoke handler as the UI. It saves evidence
in `data/decision-evaluation.json` and updates the results/analysis section of
`LLM-DM-report.md`. It compares accuracy on common successful tickets and counts
whether hybrid review fixed or damaged each preliminary DM decision. The report
also documents research, selection, strategy, failure handling and limitations.
Read the results critically: a small sample cannot establish general superiority.

## Checks

```sh
node tests/triage.cjs # Optional local tests; no paid calls
npm run typecheck
npm run build
```
