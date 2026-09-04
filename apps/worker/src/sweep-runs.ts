import { randomUUID } from "node:crypto";
import { Pool } from "pg";

/**
 * A record that a scheduled sweep ran, and how it went.
 *
 * The worker deliberately logs sweep failures rather than throwing, so a flapping
 * API cannot retry-storm the queue. That decision is sound; its cost was silence.
 * A failure never reached a failed-job count and nothing was written down, so
 * recurring charges could stop firing for a week with nothing in the console to
 * show it.
 *
 * Recording happens here in the worker rather than in the API's sweep endpoints,
 * because the failure that matters most is the one where the worker cannot reach
 * the API at all — which the API, by definition, never sees.
 */
export type SweepRun = {
  sweepName: string;
  startedAt: Date;
  finishedAt: Date;
  succeeded: boolean;
  /** HTTP status, or undefined when the request never completed. */
  responseStatus?: number;
  error?: string;
};

export interface SweepRunStore {
  record(run: SweepRun): Promise<void>;
}

export class PostgresSweepRunStore implements SweepRunStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async record(run: SweepRun): Promise<void> {
    await this.pool.query(
      `insert into worker_sweep_runs
         (sweep_run_id, sweep_name, started_at, finished_at, succeeded, response_status, error)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        run.sweepName,
        run.startedAt,
        run.finishedAt,
        run.succeeded,
        run.responseStatus ?? null,
        // Bounded: a gateway that returns a wall of HTML on error should not
        // put a wall of HTML in every row of this table.
        run.error ? run.error.slice(0, 2000) : null,
      ],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Records the outcome without ever failing the caller.
 *
 * Observability must not become a new way for the sweep to fail: if this table is
 * unreachable, the sweep itself already ran, and turning a bookkeeping error into
 * a sweep error would be exactly the retry-storm the design avoids.
 */
export async function recordSweepRun(
  store: SweepRunStore | undefined,
  run: SweepRun,
): Promise<void> {
  if (!store) {
    return;
  }
  try {
    await store.record(run);
  } catch (error) {
    console.error(
      { sweepName: run.sweepName, error: error instanceof Error ? error.message : String(error) },
      "sweep run not recorded",
    );
  }
}
