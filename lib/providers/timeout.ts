const DEFAULT_PROVIDER_TIMEOUT_MS = 8000;

export function providerTimeoutMs(): number {
  const configured = Number(process.env.PROVIDER_TIMEOUT_MS);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_PROVIDER_TIMEOUT_MS;
}

export function providerTimeoutReason(provider: string): string {
  return `${provider} timed out`;
}

export async function fetchWithProviderTimeout(
  provider: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const timeoutMs = providerTimeoutMs();
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abortForTimeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(providerTimeoutReason(provider)));
    }, timeoutMs);
  });

  const abortFromUpstream = () => controller.abort();
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
  }

  try {
    return await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      abortForTimeout,
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
}
