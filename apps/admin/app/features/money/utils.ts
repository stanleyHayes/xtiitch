import { tokens } from "../../theme";
import type { AdminMoneyWebhookStatus, AdminMoneyPayoutStatus } from "../../lib/api";



export function webhookColor(status: AdminMoneyWebhookStatus): string {
  switch (status) {
    case "verified":
      return tokens.success;
    case "replayed":
      return tokens.info;
    case "reversed":
      return tokens.warning;
    default:
      return tokens.danger;
  }
}



export function payoutColor(status: AdminMoneyPayoutStatus): string {
  switch (status) {
    case "ready":
      return tokens.success;
    case "review":
      return tokens.warning;
    default:
      return tokens.danger;
  }
}
