import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PersonAddRounded from "@mui/icons-material/PersonAddRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import HourglassBottomRounded from "@mui/icons-material/HourglassBottomRounded";
import { tokens } from "../../theme";
import { MiniStat } from "../../components/ui/MiniStat";
import { shortDate } from "../shared/utils";
import type { CrmInsights } from "./types";

// §15.1 Growth "New vs returning + last-seen / lapsed view": the strip above
// the list. Lapsed = hasn't ordered in 90+ days — the win-back list.
export function InsightsStrip({ insights }: { insights: CrmInsights }) {
  const lapsed = insights.lapsed_customers;
  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        }}
      >
        <MiniStat
          icon={<PersonAddRounded fontSize="small" />}
          label="New (30 days)"
          value={String(insights.new_customers_30d)}
          helper="First order in the last month"
          tone={tokens.success}
        />
        <MiniStat
          icon={<ReplayRounded fontSize="small" />}
          label="Returning"
          value={String(insights.returning_customers)}
          helper="More than one order with you"
          tone={tokens.info}
        />
        <MiniStat
          icon={<HourglassBottomRounded fontSize="small" />}
          label="Lapsed (90+ days)"
          value={String(lapsed.length)}
          helper="Haven't ordered in a while"
          tone={lapsed.length > 0 ? tokens.warning : tokens.success}
        />
      </Box>
      {lapsed.length > 0 ? (
        <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: "wrap" }}>
          {lapsed.slice(0, 6).map((customer) => (
            <Box
              key={customer.customer_id}
              sx={{
                px: 1.25,
                py: 0.75,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 999,
              }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                <strong>{customer.name || customer.phone}</strong> · last order{" "}
                {shortDate(customer.last_order_at)}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
