# Support ticket triage

Run `npm install`, copy `.env.example` to `.env`, configure `LLM_API_KEY`,
`LLM_BASE_URL` and `LLM_MODEL`, then run `npm run dev` (port 3033).
The provider must support chat completions with strict JSON schema output.

The home page validates and classifies tickets, displays token usage, and runs
random smoke samples from either included dataset. Request and response JSON
schemas are generated from the shared Zod definitions in `lib/schemas.ts`.
Both server and client validate triage payloads. Labelled tests show expected
and predicted categories and priorities, with mismatches summarized at the end.
Failed calls are counted separately and excluded from accuracy denominators.
Unlabelled accuracy is N/A. Missing provider token usage is shown as unavailable.

Set `LLM_INPUT_USD_PER_MILLION` and `LLM_OUTPUT_USD_PER_MILLION` to the rates
for your configured model to enable estimated USD costs. Without both rates,
cost is unavailable, rather than reported as zero. If any call has unknown
usage or cost, the run's total cost is unavailable.

Every completed smoke run, including runs where all calls fail, is appended
to `data/smoke-runs.jsonl`. `/admin` reads the history on every visit and lists
accuracy, outcomes, category/priority counts, total/average latency, estimated
cost and model. This simple local implementation needs a persistent writable
data directory; use persistent storage when hosting. `/admin` is a local
history view without authentication. Smoke calls run sequentially; hosting
request timeouts must accommodate the selected sample size.

Checks: `npm test` (mocked provider; no paid calls), `npm run typecheck` and `npm run build`.
