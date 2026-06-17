import { Pool, type PoolClient } from "pg";

export type SubscriptionBillingSweepSummary = {
  overdueInvoicesFailed: number;
  subscriptionsCanceled: number;
  businessesTouched: number;
  ranAt: Date;
};

export type SubscriptionBillingSweepStore = {
  runSubscriptionBillingSweep(reason: string): Promise<SubscriptionBillingSweepSummary>;
  close?(): Promise<void>;
};

type BillingSweepRow = {
  overdue_invoices_failed: number;
  subscriptions_canceled: number;
  businesses_touched: number;
  ran_at: Date;
};

export class PostgresSubscriptionBillingSweepStore implements SubscriptionBillingSweepStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async runSubscriptionBillingSweep(reason: string): Promise<SubscriptionBillingSweepSummary> {
    return this.withTransportBypass(async (client) => {
      const result = await client.query<BillingSweepRow>(
        `
          with free_plan as (
            select plan_id
            from plans
            where code = 'free' and is_active = true
            order by created_at
            limit 1
          ),
          failed_invoices as (
            update business_subscription_invoices i
            set
              status = 'failed',
              failed_at = coalesce(i.failed_at, now()),
              failure_reason = $1,
              updated_at = now()
            where i.status = 'issued'
              and i.due_at <= now()
            returning i.invoice_id, i.subscription_id, i.business_id, i.invoice_ref
          ),
          failed_subscriptions as (
            update business_subscriptions s
            set
              status = case
                when s.failed_payment_count + 1 >= 2 then 'grace_period'
                else 'past_due'
              end,
              failed_payment_count = s.failed_payment_count + 1,
              grace_ends_at = case
                when s.failed_payment_count + 1 >= 2 then coalesce(s.grace_ends_at, now() + interval '7 days')
                else null
              end,
              last_invoice_ref = f.invoice_ref,
              next_billing_at = case
                when s.failed_payment_count + 1 >= 2 then coalesce(s.grace_ends_at, now() + interval '7 days')
                else now() + interval '1 day'
              end,
              updated_at = now()
            from failed_invoices f
            where s.subscription_id = f.subscription_id
            returning
              s.subscription_id,
              s.business_id,
              f.invoice_id,
              f.invoice_ref,
              s.status
          ),
          failed_events as (
            insert into business_subscription_events (
              subscription_id,
              business_id,
              actor_admin_user_id,
              event_type,
              summary,
              metadata
            )
            select
              f.subscription_id,
              f.business_id,
              null,
              'subscription.invoice_overdue',
              $1,
              jsonb_build_object(
                'invoice_id', f.invoice_id::text,
                'invoice_ref', f.invoice_ref,
                'status', f.status,
                'reason', $1::text
              )
            from failed_subscriptions f
            returning 1
          ),
          canceled_subscriptions as (
            update business_subscriptions s
            set
              plan_id = coalesce((select plan_id from free_plan), s.plan_id),
              status = 'canceled',
              canceled_at = coalesce(s.canceled_at, now()),
              cancel_at_period_end = false,
              next_billing_at = null,
              updated_at = now()
            where s.status = 'grace_period'
              and s.grace_ends_at is not null
              and s.grace_ends_at <= now()
            returning s.subscription_id, s.business_id, s.plan_id
          ),
          downgraded_businesses as (
            update businesses b
            set plan_id = c.plan_id, updated_at = now()
            from canceled_subscriptions c
            where b.business_id = c.business_id
            returning 1
          ),
          canceled_events as (
            insert into business_subscription_events (
              subscription_id,
              business_id,
              actor_admin_user_id,
              event_type,
              summary,
              metadata
            )
            select
              c.subscription_id,
              c.business_id,
              null,
              'subscription.grace_expired',
              $1,
              jsonb_build_object(
                'status', 'canceled',
                'reason', $1::text
              )
            from canceled_subscriptions c
            returning 1
          ),
          touched as (
            select business_id from failed_subscriptions
            union
            select business_id from canceled_subscriptions
          ),
          summary as (
            select
              (select count(*)::int from failed_invoices) as overdue_invoices_failed,
              (select count(*)::int from canceled_subscriptions) as subscriptions_canceled,
              (select count(*)::int from touched) as businesses_touched,
              now() as ran_at
          ),
          audit_event as (
            insert into admin_audit_events (
              audit_event_id,
              actor_email,
              actor_role,
              action,
              target_type,
              target_id,
              target_label,
              summary,
              severity,
              metadata,
              user_agent
            )
            select
              gen_random_uuid(),
              'system',
              'system',
              'Ran subscription billing sweep',
              'business_subscription',
              'billing_sweep',
              'Subscription billing sweep',
              'Scheduled billing sweep failed ' || overdue_invoices_failed ||
                ' overdue invoices and canceled ' || subscriptions_canceled ||
                ' expired grace subscriptions.',
              'warning',
              jsonb_build_object(
                'overdue_invoices_failed', overdue_invoices_failed,
                'subscriptions_canceled', subscriptions_canceled,
                'businesses_touched', businesses_touched,
                'reason', $1::text,
                'source', 'worker'
              ),
              'xtiitch-worker'
            from summary
            where overdue_invoices_failed > 0 or subscriptions_canceled > 0
            returning 1
          )
          select
            overdue_invoices_failed,
            subscriptions_canceled,
            businesses_touched,
            ran_at
          from summary
        `,
        [trimReason(reason)],
      );
      return rowToSummary(result.rows[0]);
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async withTransportBypass<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('xtiitch.bypass', 'on', true)");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function runSubscriptionBillingSweep(args: {
  store: SubscriptionBillingSweepStore;
  reason: string;
}): Promise<SubscriptionBillingSweepSummary> {
  return args.store.runSubscriptionBillingSweep(trimReason(args.reason));
}

function rowToSummary(row: BillingSweepRow | undefined): SubscriptionBillingSweepSummary {
  if (!row) {
    return {
      overdueInvoicesFailed: 0,
      subscriptionsCanceled: 0,
      businessesTouched: 0,
      ranAt: new Date(),
    };
  }
  return {
    overdueInvoicesFailed: row.overdue_invoices_failed,
    subscriptionsCanceled: row.subscriptions_canceled,
    businessesTouched: row.businesses_touched,
    ranAt: row.ran_at,
  };
}

function trimReason(value: string): string {
  const trimmed = value.trim().slice(0, 500);
  return trimmed || "Scheduled subscription billing sweep.";
}
