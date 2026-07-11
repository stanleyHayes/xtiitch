import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import BlockRounded from "@mui/icons-material/BlockRounded";
import type { AdminMoneyPayoutReview } from "../../../lib/api";
import { tokens } from "../../../theme";
import { Panel } from "../../../components/ui";
import { PaginationFooter } from "../../../components/ui";
import { formatGHS } from "../../shared";
import { payoutColor } from "../utils";

export function ReversalPanel({
  reviews,
  pagedReviews,
  page,
  pageCount,
  onPageChange,
}: {
  reviews: AdminMoneyPayoutReview[];
  pagedReviews: AdminMoneyPayoutReview[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.warning, 0.16),
        backgroundImage: `
          radial-gradient(circle at 92% 2%, ${alpha(tokens.warning, 0.14)}, transparent 34%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", mb: 2 }}
      >
        <AccountBalanceRounded sx={{ color: tokens.burgundy }} />
        <Box>
          <Typography variant="h6">Settlement review</Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary" }}
          >
            Subaccount status and operator holds.
          </Typography>
        </Box>
      </Stack>
      <Stack spacing={1.5}>
        {pagedReviews.map((review) => {
          const held = review.holdActive;
          const blockedByBusinessState =
            review.status === "blocked" && !review.holdActive;
          return (
            <Box
              key={review.id}
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: held
                  ? alpha(tokens.danger, 0.32)
                  : alpha(payoutColor(review.status), 0.2),
                borderRadius: 1.5,
                bgcolor: held
                  ? alpha(tokens.danger, 0.04)
                  : alpha(tokens.white, 0.72),
                backgroundImage: `linear-gradient(90deg, ${alpha(
                  held ? tokens.danger : payoutColor(review.status),
                  0.075,
                )}, transparent 38%)`,
                transition:
                  "transform 180ms ease, border-color 180ms ease",
                "&:hover": {
                  transform: "translateX(3px)",
                  borderColor: alpha(
                    held ? tokens.danger : payoutColor(review.status),
                    0.34,
                  ),
                },
              }}
            >
              <Stack spacing={1.25}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 900 }}>
                      {review.business}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {review.subaccountRef}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={held ? "held" : review.status}
                    sx={{
                      bgcolor: alpha(
                        held
                          ? tokens.danger
                          : payoutColor(review.status),
                        0.12,
                      ),
                      color: held
                        ? tokens.danger
                        : payoutColor(review.status),
                      textTransform: "capitalize",
                    }}
                  />
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: "space-between" }}
                >
                  <Typography variant="body2">Settlement</Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 900 }}
                  >
                    {formatGHS(review.settlementMinor)}
                  </Typography>
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: "space-between" }}
                >
                  <Typography variant="body2">Commission</Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 900 }}
                  >
                    {formatGHS(review.commissionMinor)}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary" }}
                >
                  {review.nextAction}
                </Typography>
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="money:settlement-hold"
                  />
                  <input
                    type="hidden"
                    name="business_id"
                    value={review.id}
                  />
                  <input
                    type="hidden"
                    name="hold"
                    value={held ? "false" : "true"}
                  />
                  <input
                    type="hidden"
                    name="reason"
                    value={
                      held
                        ? "Operator released settlement review hold."
                        : review.nextAction
                    }
                  />
                  <Button
                    type="submit"
                    variant={held ? "contained" : "outlined"}
                    color={held ? "primary" : "error"}
                    size="small"
                    startIcon={
                      held ? (
                        <CheckCircleRounded />
                      ) : (
                        <BlockRounded />
                      )
                    }
                    disabled={blockedByBusinessState}
                  >
                    {blockedByBusinessState
                      ? "Blocked by status"
                      : held
                        ? "Release hold"
                        : "Place review hold"}
                  </Button>
                </Form>
              </Stack>
            </Box>
          );
        })}
        {reviews.length === 0 ? (
          <Box
            sx={{
              p: 2,
              border: "1px dashed",
              borderColor: alpha(tokens.warning, 0.28),
              borderRadius: 1.5,
              bgcolor: "rgba(var(--surface-rgb), 0.68)",
            }}
          >
            <Typography sx={{ fontWeight: 900 }}>
              No settlement rows yet.
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              Verified stores with subaccounts or payment
              activity will appear here for operator review.
            </Typography>
          </Box>
        ) : null}
        <PaginationFooter
          count={pageCount}
          label="payout reviews"
          page={page}
          pageSize={6}
          total={reviews.length}
          onChange={onPageChange}
        />
      </Stack>
    </Panel>
  );
}
