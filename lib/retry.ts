export class ProviderError extends Error {
  retries = 0;
  constructor(
    message: string,
    public status = 502,
    public code = "provider_error",
    public retryAfter: string | null = null,
  ) { super(message); }
}

// Both the HTTP-date and delta-seconds forms are allowed by HTTP.
export function retryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value?.trim()) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? Math.ceil(seconds * 1000) : null;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export function providerError(error: unknown, provider: string): ProviderError {
  if (error instanceof ProviderError) return error;
  // OpenAI SDK errors expose status and Headers. Never forward raw provider text or credentials.
  const value = error as { status?: number; code?: string; headers?: Headers } | null;
  const status = value?.status ?? 502;
  const detail = status === 429 ? "rate limit reached" : status === 401 || status === 403
    ? "authentication failed; check the server API key" : "request failed or timed out";
  return new ProviderError(`${provider}: ${detail}.`, status, value?.code || "provider_error", value?.headers?.get("retry-after") ?? null);
}

export async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  options: { sleep?: (ms: number) => Promise<void>; random?: () => number; maxWaitMs?: number } = {},
): Promise<{ value: T; retries: number }> {
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  let waited = 0;
  for (let retries = 0; ; retries++) {
    try { return { value: await operation(), retries }; }
    catch (error) {
      const failure = providerError(error, "Provider");
      failure.retries = retries;
      const requestedWait = retryAfterMs(failure.retryAfter);
      const baseWait = failure.status === 429 && requestedWait === null ? 10000 : 1000;
      const delay = Math.max(requestedWait ?? 0, baseWait * 2 ** retries + Math.floor(random() * 250));
      // Never shorten Retry-After. Daily quotas and waits beyond our budget fail clearly instead.
      if (![429, 502, 503].includes(failure.status) || failure.code === "quota_exceeded" || retries >= 3 || waited + delay > (options.maxWaitMs ?? 90000)) {
        if (failure.status === 429) failure.message += failure.code === "quota_exceeded"
          ? " Daily quota exhausted; retry after the UTC quota reset."
          : ` Retry later${failure.retryAfter ? ` (Retry-After: ${failure.retryAfter})` : ""}.`;
        throw failure;
      }
      await sleep(delay);
      waited += delay;
    }
  }
}
