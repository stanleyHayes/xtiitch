import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import { tokens } from "../../theme";
import { Panel, SectionHeader, PaginationFooter } from "../../components/ui";
import { usePagedItems } from "../shared/usePagedItems";
import { AdminRiskReview, AdminActionFeedback } from "../shared/types";
import { shortTime, riskColor } from "../shared";
import { RiskChip } from "../shared/RiskChip";

export function RiskSection({
  riskReviews,
  riskReviewError,
  actionData,
}: {
  riskReviews: AdminRiskReview[];
  riskReviewError: string | null;
  actionData?: AdminActionFeedback;
}) {
  const {
    page: riskPage,
    pageCount: riskPageCount,
    pagedItems: pagedRiskReviews,
    setPage: setRiskPage,
  } = usePagedItems(riskReviews, 6, riskReviews.length);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Trust and compliance"
        title="Risk review"
        helper="Open issues for payment integrity, tenant isolation evidence, complaints, and manual escalation."
      />
      {actionData?.section === "risk" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {riskReviewError ? (
        <Alert severity="warning">{riskReviewError}</Alert>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "repeat(3, 1fr)" },
        }}
      >
        {pagedRiskReviews.map((item) => {
          const closed = item.status === "closed";
          return (
            <Panel
              key={item.id}
              sx={{
                p: 2.5,
                minHeight: "100%",
                borderColor: alpha(riskColor(item.level), 0.22),
                backgroundImage: `
                  radial-gradient(circle at 100% 0%, ${alpha(riskColor(item.level), closed ? 0.06 : 0.12)}, transparent 34%),
                  linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
                `,
                opacity: closed ? 0.72 : 1,
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: alpha(riskColor(item.level), 0.36),
                  boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.1)}`,
                },
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Stack direction="row" spacing={1}>
                    <RiskChip level={item.level} />
                    {closed ? (
                      <Chip
                        size="small"
                        label="closed"
                        sx={{ color: tokens.success }}
                      />
                    ) : null}
                  </Stack>
                  <Chip
                    size="small"
                    label={item.owner}
                    variant="outlined"
                  />
                </Stack>
                <Box>
                  <Typography variant="h6">{item.title}</Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary" }}
                  >
                    {item.business}
                  </Typography>
                </Box>
                <Typography sx={{ color: "text.secondary" }}>
                  {item.reason}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary" }}
                >
                  Updated {shortTime(item.updatedAt)}
                </Typography>
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="admin-risk-review:update"
                  />
                  <input
                    type="hidden"
                    name="review_key"
                    value={item.id}
                  />
                  <input
                    type="hidden"
                    name="status"
                    value={closed ? "open" : "closed"}
                  />
                  <input
                    type="hidden"
                    name="reason"
                    value={
                      closed
                        ? `Reopened ${item.title}`
                        : `Closed ${item.title}`
                    }
                  />
                  <Button
                    type="submit"
                    variant={closed ? "contained" : "outlined"}
                    startIcon={
                      closed ? (
                        <CheckCircleRounded />
                      ) : (
                        <PersonSearchRounded />
                      )
                    }
                    fullWidth
                  >
                    {closed ? "Reopen review" : "Close review"}
                  </Button>
                </Form>
              </Stack>
            </Panel>
          );
        })}
        {!riskReviewError && riskReviews.length === 0 ? (
          <Box
            sx={{
              p: 2,
              border: "1px dashed",
              borderColor: alpha(tokens.success, 0.28),
              borderRadius: 1.5,
              bgcolor: "rgba(var(--surface-rgb), 0.68)",
            }}
          >
            <Typography sx={{ fontWeight: 900 }}>
              No active risk signals.
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              Payment failures, active holds, suspended stores, and
              rejected verification cases will appear here.
            </Typography>
          </Box>
        ) : null}
      </Box>
      <PaginationFooter
        count={riskPageCount}
        label="risk reviews"
        page={riskPage}
        pageSize={6}
        total={riskReviews.length}
        onChange={setRiskPage}
      />
    </Stack>
  );
}
