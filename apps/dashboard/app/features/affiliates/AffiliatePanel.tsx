import { useMemo, useState } from "react";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Form } from "react-router";
import { formatGHS } from "../../lib/format";
import type { Design } from "../../lib/api";
import type { CollectionSummary, DashboardActionData } from "../shared/types";
import type { BusinessAffiliateData } from "./types";
import { AffiliateCreateForm, ProgrammeForm } from "./AffiliateForms";

export function AffiliatePanel({
  data,
  collections,
  designs,
  storeHandle,
  action,
}: {
  data: BusinessAffiliateData;
  collections: CollectionSummary[];
  designs: Design[];
  storeHandle: string;
  action: DashboardActionData;
}) {
  const [showProgrammeForm, setShowProgrammeForm] = useState(false);
  const totalCommission = data.attribution.reduce(
    (sum, item) => sum + item.commission_minor,
    0,
  );
  return (
    <Stack spacing={2}>
      {action.affiliateError ? (
        <Alert severity="error">{action.affiliateError}</Alert>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        }}
      >
        <Summary label="Programmes" value={String(data.programmes.length)} />
        <Summary
          label="Active affiliates"
          value={String(
            data.affiliates.filter((item) => item.status === "active").length,
          )}
        />
        <Summary label="Commission tracked" value={formatGHS(totalCommission)} />
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography variant="h6">Programme policy</Typography>
              <Typography variant="body2" color="text.secondary">
                Each programme targets one store, collection, design, or
                product scope.
              </Typography>
            </Box>
            <Button
              startIcon={<AddRounded />}
              onClick={() => setShowProgrammeForm((value) => !value)}
            >
              New programme
            </Button>
          </Box>
          {showProgrammeForm ? <ProgrammeForm /> : null}
          {data.programmes.length === 0 ? (
            <Typography color="text.secondary">
              Create a programme before adding affiliates.
            </Typography>
          ) : (
            data.programmes.map((programme) => (
              <ProgrammeForm
                key={programme.affiliate_programme_id}
                programme={programme}
              />
            ))
          )}
        </Stack>
      </Paper>

      <AffiliateRoster
        data={data}
        collections={collections}
        designs={designs}
        storeHandle={storeHandle}
      />
    </Stack>
  );
}

function AffiliateRoster({
  data,
  collections,
  designs,
  storeHandle,
}: {
  data: BusinessAffiliateData;
  collections: CollectionSummary[];
  designs: Design[];
  storeHandle: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const performance = useMemo(
    () =>
      new Map(data.attribution.map((item) => [item.affiliate_id, item])),
    [data.attribution],
  );
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography variant="h6">Affiliate roster</Typography>
            <Typography variant="body2" color="text.secondary">
              Codes are globally unique across affiliate, promotion, and
              referral campaigns.
            </Typography>
          </Box>
          <Button
            startIcon={<AddRounded />}
            disabled={!data.programmes.some((item) => item.status === "active")}
            onClick={() => setShowForm((value) => !value)}
          >
            Add affiliate
          </Button>
        </Box>
        {showForm ? (
          <AffiliateCreateForm
            programmes={data.programmes}
            collections={collections}
            designs={designs}
          />
        ) : null}
        {data.affiliates.map((affiliate) => {
          const stats = performance.get(affiliate.affiliate_id);
          const link = `https://${storeHandle}.xtiitch.com/?affiliate_code=${encodeURIComponent(affiliate.code)}`;
          return (
            <Box key={affiliate.affiliate_id}>
              <Divider sx={{ mb: 1.5 }} />
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "minmax(0, 1.5fr) repeat(4, minmax(90px, .6fr)) auto",
                  },
                  alignItems: "center",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    {affiliate.display_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {affiliate.code} · {affiliate.programme_name} ·{" "}
                    {affiliate.target_scope}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<ContentCopyRounded />}
                    onClick={() => navigator.clipboard?.writeText(link)}
                  >
                    Copy link
                  </Button>
                </Box>
                <Summary label="Clicks" value={String(stats?.click_count ?? 0)} />
                <Summary label="Signups" value={String(stats?.signup_count ?? 0)} />
                <Summary
                  label="Sales"
                  value={formatGHS(stats?.gross_minor ?? 0)}
                />
                <Summary
                  label="Commission"
                  value={formatGHS(stats?.commission_minor ?? 0)}
                />
                <AffiliateStatus
                  affiliateID={affiliate.affiliate_id}
                  status={affiliate.status}
                />
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}

function AffiliateStatus({
  affiliateID,
  status,
}: {
  affiliateID: string;
  status: "active" | "paused";
}) {
  if (status !== "active") {
    return <Typography variant="caption">Paused</Typography>;
  }
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="pause_business_affiliate" />
      <input type="hidden" name="affiliate_id" value={affiliateID} />
      <Button type="submit" color="warning">
        Pause
      </Button>
    </Form>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}
