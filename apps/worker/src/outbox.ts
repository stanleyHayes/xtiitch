import { Pool, type PoolClient } from "pg";

export type OutboundMessage = {
  messageId: string;
  businessId: string;
  channel: string;
  kind: string;
  recipient: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type DrainSummary = {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
};

export type NotificationSendResult = {
  providerMessageId?: string;
  providerResponse?: Record<string, unknown>;
};

export type NotificationSender = {
  send(message: OutboundMessage): Promise<NotificationSendResult | undefined>;
};

export type OutboxStore = {
  claimDueMessages(batchSize: number, leaseSeconds: number): Promise<OutboundMessage[]>;
  markSent(messageId: string, result?: NotificationSendResult): Promise<void>;
  markFailed(
    message: OutboundMessage,
    error: string,
    retryDelayMs: number,
    terminal: boolean,
  ): Promise<"dead" | "pending">;
  close?(): Promise<void>;
};

type OutboundMessageRow = {
  message_id: string;
  business_id: string;
  channel: string;
  kind: string;
  recipient: string;
  payload: unknown;
  attempts: number;
};

export class PostgresOutboxStore implements OutboxStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async claimDueMessages(batchSize: number, leaseSeconds: number): Promise<OutboundMessage[]> {
    return this.withTransportBypass(async (client) => {
      const result = await client.query<OutboundMessageRow>(
        `
          with due as (
            select message_id
            from outbound_messages
            where status in ('pending', 'sending') and available_at <= now()
            order by available_at, created_at
            limit $1
            for update skip locked
          )
          update outbound_messages m
          set status = 'sending',
            attempts = m.attempts + 1,
            available_at = now() + ($2::int * interval '1 second'),
            updated_at = now()
          from due
          where m.message_id = due.message_id
          returning m.message_id::text, m.business_id::text, m.channel, m.kind,
            m.recipient, m.payload, m.attempts
        `,
        [batchSize, leaseSeconds],
      );
      return result.rows.map(rowToMessage);
    });
  }

  async markSent(messageId: string, result?: NotificationSendResult): Promise<void> {
    await this.withTransportBypass(async (client) => {
      await client.query(
        `
          update outbound_messages
          set status = 'sent',
            last_error = '',
            provider_message_id = $2,
            provider_response = $3::jsonb,
            sent_at = now(),
            updated_at = now()
          where message_id = $1 and status = 'sending'
        `,
        [
          messageId,
          trimProviderMessageId(result?.providerMessageId ?? ""),
          JSON.stringify(result?.providerResponse ?? {}),
        ],
      );
    });
  }

  async markFailed(
    message: OutboundMessage,
    error: string,
    retryDelayMsValue: number,
    terminal: boolean,
  ): Promise<"dead" | "pending"> {
    const nextStatus = terminal ? "dead" : "pending";
    await this.withTransportBypass(async (client) => {
      await client.query(
        `
          update outbound_messages
          set status = $2,
            last_error = $3,
            available_at = case
              when $2 = 'dead' then now()
              else now() + ($4::int * interval '1 millisecond')
            end,
            updated_at = now()
          where message_id = $1 and status = 'sending'
        `,
        [message.messageId, nextStatus, trimError(error), retryDelayMsValue],
      );
    });
    return nextStatus;
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

export async function drainOutbox(args: {
  store: OutboxStore;
  sender: NotificationSender;
  batchSize: number;
  leaseSeconds: number;
  retryPolicy: RetryPolicy;
}): Promise<DrainSummary> {
  const messages = await args.store.claimDueMessages(args.batchSize, args.leaseSeconds);
  const summary: DrainSummary = { claimed: messages.length, sent: 0, failed: 0, dead: 0 };

  for (const message of messages) {
    try {
      const result = await args.sender.send(message);
      await args.store.markSent(message.messageId, result ?? undefined);
      summary.sent += 1;
    } catch (error) {
      const terminal = message.attempts >= args.retryPolicy.maxAttempts;
      const status = await args.store.markFailed(
        message,
        errorMessage(error),
        terminal ? 0 : retryDelayMs(message.attempts, args.retryPolicy),
        terminal,
      );
      if (status === "dead") {
        summary.dead += 1;
      } else {
        summary.failed += 1;
      }
    }
  }

  return summary;
}

export function retryDelayMs(attempts: number, policy: RetryPolicy): number {
  const exponent = Math.max(0, attempts - 1);
  const delay = policy.baseDelayMs * 2 ** exponent;
  return Math.min(delay, policy.maxDelayMs);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown notification send failure";
}

function rowToMessage(row: OutboundMessageRow): OutboundMessage {
  return {
    messageId: row.message_id,
    businessId: row.business_id,
    channel: row.channel,
    kind: row.kind,
    recipient: row.recipient,
    payload: recordPayload(row.payload),
    attempts: row.attempts,
  };
}

function recordPayload(payload: unknown): Record<string, unknown> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function trimError(error: string): string {
  return error.slice(0, 2_000);
}

function trimProviderMessageId(value: string): string {
  return value.trim().slice(0, 200);
}
