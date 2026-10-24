# LLM and Decision Model evaluation

## Decision Model research and selection

According to the course presentation, a Decision Model evaluates a state and answers typed questions by selecting from predefined options and returning probabilities. This fits category classification, priority scoring and escalation decisions.

### Alternatives considered

| Service | Fit and availability | Selection consideration |
| --- | --- | --- |
| [vLLM Semantic Router — Decision 3.0](https://decision.vllm-sr.ai/docs) | Dedicated decision models; free hosted REST API with typed questions and probabilities | Selected: directly matches the course interface and needs no paid inference plan |
| [Cloudflare Workers AI — Clef](https://developers.cloudflare.com/workers-ai/models/clef/) | Decision model supporting typed questions and option probabilities; Workers AI has a [limited free daily allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/) | Valid alternative; would require Cloudflare configuration and model-specific quota accounting |
| [OpenAI Decisions API](https://developers.openai.com/api/docs/guides/decisions) | Dedicated endpoint for choices, predicates and scores, with usage-based pricing | Appropriate interface, but a general free allowance was not established for this assignment |
| [TypeSafe Jev via OpenRouter](https://openrouter.ai/typesafe) | Hosted structured decision models; listed Jev models have input-token pricing | Valid alternative; a general free allowance was not confirmed |

These alternatives were compared through documentation, not experimentally benchmarked against each other. Availability and pricing may change.

### Selected service

We selected **Decision 3.0**, initially **`vllm-sr/d3-flash`**. It supports predefined choices, ordered scores, yes/no probabilities and several questions about one ticket in one REST request. Its free hosted API fits the assignment's budget. The model can be configured through `DECISION_MODEL`; the base URL defaults to `https://decision.vllm-sr.ai`.

Sources: [API reference](https://decision.vllm-sr.ai/docs), [service terms](https://decision.vllm-sr.ai/terms). Research checked on 24 October 2026.

## Integration strategy

The frontend and existing smoke runner support three strategies:

1. **LLM-only:** the existing LLM classifies the original ticket using strict JSON output.
2. **DM-only:** send the ticket as `state` with three typed questions. Category uses `choice` with account, billing, feature_request and technical_bug. Priority uses `score` with low, medium and high levels. Escalation uses `noul` to estimate whether human review is required.
3. **DM+LLM (hybrid):** run the DM first, then send the original ticket, its DM predictions, confidence scores and probability distributions to the LLM. The LLM independently keeps or revises the decisions. Its output is the final result.

Priority maps to the level with the highest probability (ties prefer the lower level). The expected score is retained for inspection, rather than rounded into a class. Human review is true at probability >= 0.5. The provider's category and priority confidence fields are preserved separately from per-option probabilities. They describe the DM stage; they are not presented as confidence in the final hybrid answer. These choices were fixed before evaluation.

All requests and final results pass through Zod. DM answers also validate allowed labels, question types, finite probabilities in [0,1], and distributions summing to approximately one (a 0.02 tolerance accommodates rounding). Invalid or missing question answers fail explicitly; there is no silent fallback to another strategy. In hybrid mode, a failed review remains a failed hybrid prediction, with the completed DM stage's usage retained.

Token usage, estimated cost, latency, retry counts and model identity are recorded per stage and per run. DM output tokens are zero. DM monetary cost is zero for the selected free API; LLM costs use configured USD-per-million input/output rates. Missing rates or usage are displayed as unavailable. Partial usage remains visible when one stage fails. For OpenAI-compatible providers that exclude hidden reasoning from completion_tokens but include it in total_tokens, output usage is total minus input, retaining reasoning in token and cost accounting.

### Rate limits and reliability

Both inference paths use bounded retries: at most three retries beyond the initial request. HTTP 429, 502 and 503 use exponential backoff with jitter. Without a valid Retry-After header, 429 backoff starts at 10 seconds to accommodate per-minute budgets. `Retry-After` supports seconds and HTTP dates; retries never happen sooner than the server requests. Retry waits have a 90-second cumulative budget. A longer requested wait fails explicitly instead of shortening it. Daily quota errors are not retried. The runner stops attempting the rest of a sample after exhausted rate limits, quota failures or invalid credentials, records those tickets as unattempted failures, and logs the run.

Provider calls have timeouts. Credentials stay on the server. DM-only does not need an LLM key. The hosted Decision API may log submitted data; the evaluation uses the supplied synthetic support-ticket dataset.

## Evaluation method

Use the labelled 100-ticket dataset. Select a random seed once, rank tickets deterministically from that seed and their IDs, and reuse exactly the same sample in all strategies. No labelled answers are sent to the models. To reproduce the comparison, select the labelled dataset in the frontend, enter a sample size of 5 and the seed recorded below, then click **Compare all three**. This reproduces ticket selection; new model outputs and timings may vary.

Record category/priority accuracy, mismatches, coverage, end-to-end latency, tokens, estimated cost and retries. Report successful-prediction accuracy separately from failures. Compare accuracy on the intersection of tickets that succeeded in every strategy. For hybrid, count wrong-to-correct and correct-to-wrong changes against that pipeline's own DM stage.

## Results and final analysis

<!-- evaluation:start -->
Evaluated at 2026-10-23T23:15:24.945Z. Dataset: labelled100. Random sample: 5 tickets, without replacement. Seed: `2c539ae6-3788-4ccf-9416-38367ac3479a`.

Ticket IDs: TCK-10150, TCK-10434, TCK-10131, TCK-10034, TCK-10369.

All three strategies used exactly these tickets. Labels were used only for evaluation, never included in inference requests. Results below are real API calls, not mocked tests.

| Strategy | Model(s) | Succeeded / failed | Category accuracy | Priority accuracy | Category / priority mismatches | Total / per sampled ticket latency | Input / output / total tokens | Estimated cost | Retries |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| llm | gemini-3.5-flash | 5 / 0 | 100.0% | 40.0% | 0 / 3 | 27.16s / 5.43s | 759 / 3361 / 4120 | Unavailable | 1 |
| dm | vllm-sr/d3-flash | 5 / 0 | 80.0% | 20.0% | 1 / 4 | 1.88s / 0.38s | 2662 / 0 / 2662 | $0.000000 | 0 |
| hybrid | vllm-sr/d3-flash + gemini-3.5-flash | 5 / 0 | 100.0% | 60.0% | 0 / 2 | 72.47s / 14.49s | 5161 / 3587 / 8748 | Unavailable | 5 |

Accuracy and mismatches above use successful predictions. Failures and unattempted tickets are excluded, so compare coverage as well. Latency is end-to-end and includes retry waits; per-ticket latency divides by the full sample, including unattempted tickets. Unknown costs are not treated as zero. Usage reflects returned counts; unreported work in timed-out provider calls cannot be measured and may still be billed. DM cost is $0 for this free API; this does not measure the provider's compute cost.

For a fair accuracy comparison across successes, 5/5 tickets succeeded in all three strategies:

| Strategy | Category accuracy on common successes | Priority accuracy on common successes |
| --- | --- | --- |
| llm | 100.0% | 40.0% |
| dm | 80.0% | 20.0% |
| hybrid | 100.0% | 60.0% |

### 1. Did the DM outperform the LLM?
On the 5 tickets successful in both DM and LLM, DM minus LLM accuracy was -20.0 percentage points for category and -20.0 percentage points for priority. Neither metric alone establishes an overall winner.
Total observed latency was 1.88s for DM and 27.16s for LLM. The DM run was faster in this experiment.

### 2. Did the hybrid improve accuracy?
On the 5 tickets successful in both hybrid and LLM, hybrid minus LLM accuracy was 0.0 percentage points for category and 20.0 percentage points for priority.
Within the hybrid pipeline itself, the LLM changed 1 category prediction: 1 wrong-to-correct, 0 correct-to-wrong. It changed 3 priority predictions: 2 wrong-to-correct, 0 correct-to-wrong. Other changes, if any, were wrong-to-wrong. These counts compare each hybrid ticket's actual preliminary DM decision with its final LLM review, rather than assuming a separate DM run is identical.

### 3. Was the added complexity justified?
Reliability: LLM 5/5, DM 5/5, hybrid 5/5 successful. Hybrid requires both services to succeed and makes two sequential inference calls per successful ticket. It adds probability validation, output mapping, review prompting, stage accounting and retry handling.
Latency: hybrid took 72.47s in total, compared with 27.16s for LLM and 1.88s for DM. Cost: LLM Unavailable, DM $0.000000, hybrid Unavailable. LLM pricing was not configured or usage was missing, so no monetary savings claim can be made.
The hybrid improved at least one accuracy metric without reducing the other on common successes in this sample. This suggests a possible benefit, but the extra service dependency, latency and implementation effort still need to be weighed against the size of that gain.

### Experimental limitations and failures
Earlier failed attempts are preserved in the local evidence file. The main table uses the latest run for each strategy, so its coverage alone does not describe every attempt:

- Previous hybrid attempt fe1b2796-e41d-4f78-9b3e-c06b096bd426: 0/5 succeeded, 5 failed or unattempted; LLM: rate limit reached. Retry later.

The hybrid needed a separate rerun after rate limiting, in addition to the retries measured in its final run. Its rerun used the longer fallback backoff; timings reflect different quota conditions and are operational measurements rather than a controlled comparison of model compute speed. This failure should be considered when judging added complexity.
This is one small random sample (5/100 labelled tickets), not a statistically conclusive benchmark. Network load, warm-up and service quotas can affect timings. Strategies ran in the order LLM, DM, hybrid. The DM inside hybrid is a separate call and may differ from the DM-only run. Thresholds were fixed before evaluation; no tuning used these labels.

Local evidence (ignored by Git and not included in the repository submission): `data/decision-evaluation.json`; run IDs: `920a4ea9-5a3a-492f-ba55-9b0fc8e48f3c`, `52bb93e6-824c-4cd9-844c-746e6b852791`, `ef65f7c4-d017-4784-922d-891e9ae5662c`. These run logs are visible at `/admin` on the original development machine. A fresh checkout starts without historical logs; running the frontend comparison creates new ones.
<!-- evaluation:end -->
