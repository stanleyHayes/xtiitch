import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { DashboardPageMeta, MoneySummary, OrderSummary, AvailabilityWindow } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { PriorityRibbon } from "../../components/ui/PriorityRibbon";
import { HeaderSignal } from "../../components/ui/HeaderSignal";

export function WorkspaceHeader({
  meta,
  canManage,
  moneySummary,
  liveOrders,
  activeBookings,
  availabilityWindows,
  pendingPayments,
  needsMeasurements,
  openHandovers,
  pendingMessages,
}: {
  meta: DashboardPageMeta;
  canManage: boolean;
  moneySummary: MoneySummary;
  liveOrders: OrderSummary[];
  activeBookings: number;
  availabilityWindows: AvailabilityWindow[];
  pendingPayments: number;
  needsMeasurements: number;
  openHandovers: number;
  pendingMessages: number;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2.25, md: 3 },
        mb: 2.5,
        position: "relative",
        bgcolor: tokens.charcoal,
        color: "common.white",
        borderColor: alpha(tokens.ink, 0.1),
        backgroundImage: `linear-gradient(135deg, ${alpha(meta.tone, 0.32)}, transparent 44%), linear-gradient(180deg, ${alpha(tokens.white, 0.08)}, transparent)`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          right: { xs: -38, md: -18 },
          top: { xs: -34, md: -42 },
          color: alpha(tokens.white, 0.075),
          transform: "rotate(-10deg)",
          "& .MuiSvgIcon-root": {
            fontSize: { xs: 150, md: 210 },
          },
        }}
      >
        {meta.icon}
      </Box>
      <Stack
        spacing={2.25}
        sx={{
          position: "relative",
        }}
      >
        <Box sx={{ maxWidth: 920 }}>
          <Typography
            variant="overline"
            sx={{ color: alpha(tokens.white, 0.68), fontWeight: 900 }}
          >
            {meta.eyebrow}
          </Typography>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              mt: 0.5,
              maxWidth: 760,
              fontSize: { xs: "2rem", md: "2.55rem" },
              lineHeight: 1.04,
            }}
          >
            {meta.title}
          </Typography>
          <Typography
            sx={{
              mt: 1.25,
              color: alpha(tokens.white, 0.72),
              maxWidth: 700,
            }}
          >
            {meta.helper}
          </Typography>
          <PriorityRibbon
            canManage={canManage}
            pendingPayments={pendingPayments}
            needsMeasurements={needsMeasurements}
            activeBookings={activeBookings}
            openHandovers={openHandovers}
            pendingMessages={pendingMessages}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            width: "100%",
            maxWidth: 980,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          <HeaderSignal
            icon={
              canManage ? <AccountBalanceWalletRounded /> : <TimelineRounded />
            }
            tone={canManage ? tokens.gold : tokens.info}
            title={
              canManage
                ? formatGHS(moneySummary.net_income_minor)
                : `${liveOrders.length} live orders`
            }
            helper={
              canManage
                ? `${pendingPayments} payment follow-ups`
                : `${needsMeasurements} measurement captures`
            }
          />
          <HeaderSignal
            icon={<EventAvailableRounded />}
            tone={tokens.info}
            title={`${activeBookings} active visits`}
            helper={`${availabilityWindows.length} windows · ${openHandovers} handovers`}
          />
        </Box>
      </Stack>
    </Panel>
  );
}