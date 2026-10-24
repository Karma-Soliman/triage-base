import type { Stage, TriageResult } from "./schemas";
import { ProviderError } from "./retry";

export class TriageError extends Error {
  constructor(message: string, public stages: Stage[] = [], public status = 502, public code = "invalid_response", public retryAfter: string | null = null) { super(message); }
}
export function failedStage(provider: Stage["provider"], model: string, started: number, error: unknown, stages: Stage[] = []): TriageError {
  if (error instanceof TriageError) return error;
  const failure = error instanceof ProviderError ? error : new ProviderError(`${provider.toUpperCase()} request failed. Check configuration or retry.`);
  return new TriageError(failure.message, [...stages, {
    provider, model, prediction: null, usage: null, latencyMs: Date.now() - started,
    costUsd: null, retries: failure.retries,
  }], failure.status, failure.code, failure.retryAfter);
}
export function totals(stages: Stage[]): { usage: TriageResult["usage"]; costUsd: number | null } {
  return {
    usage: stages.every(s => s.usage !== null) ? stages.reduce((sum, s) => ({
      input: sum.input + s.usage!.input, output: sum.output + s.usage!.output, total: sum.total + s.usage!.total,
    }), { input: 0, output: 0, total: 0 }) : null,
    costUsd: stages.every(s => s.costUsd !== null) ? stages.reduce((sum, s) => sum + s.costUsd!, 0) : null,
  };
}
