import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import { tokens } from "../../theme";
import { PriorityRibbonItem } from "../../features/shared/types";

export function PriorityRibbon({
  canManage,
  pendingPayments,
  needsMeasurements,
  activeBookings,
  openHandovers,
  pendingMessages,
}: {
  canManage: boolean;
  pendingPayments: number;
  needsMeasurements: number;
  activeBookings: number;
  openHandovers: number;
  pendingMessages: number;
}) {
  const items: PriorityRibbonItem[] = [
    ...(canManage
      ? [
          {
            label: "Draft pay",
            value: pendingPayments,
            href: "/dashboard/money",
            icon: <ReceiptLongRounded fontSize="small" />,
            tone: tokens.warning,
          },
        ]
      : []),
    {
      label: "Measurements",
      value: needsMeasurements,
      href: "/dashboard/measurements",
      icon: <StraightenRounded fontSize="small" />,
      tone: tokens.burgundy,
    },
    {
      label: "Visits",
      value: activeBookings,
      href: "/dashboard/visits",
      icon: <CalendarMonthRounded fontSize="small" />,
      tone: tokens.info,
    },
    {
      label: "Handovers",
      value: openHandovers,
      href: "/dashboard/handovers",
      icon: <LocalShippingRounded fontSize="small" />,
      tone: tokens.warning,
    },
    {
      label: "Messages",
      value: pendingMessages,
      href: "/dashboard/messages",
      icon: <NotificationsRounded fontSize="small" />,
      tone: tokens.success,
    },
  ];

  return (
    <Box
      sx={{
        mt: 2.25,
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
      }}
    >
      {items.map((item) => {
        const needsAction = item.value > 0;
        return (
          <Button
            key={item.href}
            component={RouterLink}
            to={item.href}
            aria-label={`${item.label}: ${item.value}`}
            sx={{
              flex: { xs: "1 1 calc(50% - 8px)", sm: "0 0 auto" },
              minHeight: 42,
              minWidth: 0,
              pl: 1,
              pr: 0.75,
              py: 0.6,
              borderRadius: 999,
              justifyContent: "flex-start",
              textTransform: "none",
              color: tokens.white,
              border: "1px solid",
              borderColor: needsAction
                ? alpha(item.tone, 0.5)
                : alpha(tokens.white, 0.12),
              bgcolor: needsAction
                ? alpha(item.tone, 0.16)
                : alpha(tokens.white, 0.05),
              transition:
                "background-color 160ms ease, border-color 160ms ease, transform 160ms ease",
              "&:hover": {
                bgcolor: alpha(item.tone, 0.26),
                borderColor: alpha(item.tone, 0.55),
                transform: "translateY(-1px)",
              },
            }}
          >
            <Stack
              direction="row"
              spacing={0.85}
              sx={{ alignItems: "center", minWidth: 0 }}
            >
              <Box
                component="span"
                sx={{
                  color: item.tone,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Typography
                component="span"
                sx={{
                  fontSize: 13,
                  fontWeight: 750,
                  letterSpacing: "0.01em",
                  color: alpha(tokens.white, 0.92),
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </Typography>
              <Box
                component="span"
                sx={{
                  ml: 0.25,
                  minWidth: 22,
                  height: 22,
                  px: 0.5,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 900,
                  flexShrink: 0,
                  color: needsAction ? tokens.white : alpha(tokens.white, 0.5),
                  bgcolor: needsAction ? item.tone : alpha(tokens.white, 0.1),
                }}
              >
                {item.value}
              </Box>
            </Stack>
          </Button>
        );
      })}
    </Box>
  );
}