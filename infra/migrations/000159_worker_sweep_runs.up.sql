-- Durable evidence that the scheduled sweeps are still firing.
--
-- The worker deliberately logs sweep failures rather than throwing, so a flapping
-- API cannot retry-storm the queue. The cost of that decision was silence: a
-- failure never reached a failed-job count, no run was recorded anywhere, and
-- recurring charges could stop firing for a week with nothing in the console to
-- show it.
--
-- One row per attempt, success or failure, so the console can answer "when did
-- recurring charges last succeed" — and so a sweep that has stopped running
-- entirely is visible by the absence of recent rows rather than only by someone
-- noticing the money stopped moving.
create table if not exists worker_sweep_runs (
    sweep_run_id    uuid primary key,
    sweep_name      text        not null,
    started_at      timestamptz not null,
    finished_at     timestamptz not null,
    succeeded       boolean     not null,
    -- HTTP status from the internal endpoint, null when the request never
    -- completed at all. That distinction matters: a 500 means the API was
    -- reached and refused, a null means the worker could not reach it.
    response_status integer,
    error           text,
    created_at      timestamptz not null default now()
);

-- The console's question is always "the latest run of this sweep".
create index if not exists worker_sweep_runs_name_started_idx
    on worker_sweep_runs (sweep_name, started_at desc);

-- Retention sweeps and "what failed recently" both read by time alone.
create index if not exists worker_sweep_runs_started_idx
    on worker_sweep_runs (started_at desc);

grant select, insert, delete on worker_sweep_runs to xtiitch_app;
