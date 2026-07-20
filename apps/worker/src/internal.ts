import type { Fetcher } from "./senders/types";

// InternalApiClient calls the API's /v1/internal/* scheduler trigger endpoints
// (§13.3 sweeps, §14.1 scheduled reports, §3.3 settlement sync). The worker
// cannot hold admin credentials; it authenticates with the shared
// X-Internal-Token header instead. The sweeps themselves live API-side (same
// service methods the admin console triggers) — this client only fires them.
export type InternalApiConfig = {
  apiUrl: string;
  token: string;
  timeoutMs: number;
};

export type InternalSweepResult = {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
};

const MAX_ATTEMPTS = 2; // one try + one retry, then log and move on

export class InternalApiClient {
  private readonly fetcher: Fetcher;

  constructor(
    private readonly config: InternalApiConfig,
    fetcher: Fetcher = fetch,
  ) {
    this.fetcher = fetcher;
  }

  // post triggers one internal endpoint. It NEVER throws: a failure (network
  // error, non-2xx) is retried once and then returned as { ok: false } so the
  // queue logs it and carries on instead of crash-looping the repeatable job.
  async post(path: string): Promise<InternalSweepResult> {
    let lastResult: InternalSweepResult = { ok: false, error: "no attempt made" };
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      lastResult = await this.attempt(path);
      if (lastResult.ok) {
        return lastResult;
      }
      // A 4xx is a configuration problem (bad token, endpoint disabled), not a
      // transient fault — retrying cannot help it.
      if (lastResult.status !== undefined && lastResult.status < 500) {
        return lastResult;
      }
    }
    return lastResult;
  }

  private async attempt(path: string): Promise<InternalSweepResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetcher(
        `${this.config.apiUrl}/v1/internal${path}`,
        {
          method: "POST",
          headers: { "X-Internal-Token": this.config.token },
          signal: controller.signal,
        },
      );
      const body = await parseBody(response);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          body,
          error: `internal endpoint returned ${response.status}`,
        };
      }
      return { ok: true, status: response.status, body };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// runInternalSweep fires one sweep endpoint and returns its result for the
// job to log. Exported for the job registrations in index.ts.
export async function runInternalSweep(args: {
  client: InternalApiClient;
  path: string;
}): Promise<InternalSweepResult> {
  return args.client.post(args.path);
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (text.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.slice(0, 500);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "AbortError"
      ? `request timed out: ${error.message}`
      : error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown internal api failure";
}
