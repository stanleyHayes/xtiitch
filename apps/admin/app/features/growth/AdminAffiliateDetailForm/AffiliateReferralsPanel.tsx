import { Form } from "react-router";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "../../../components/form-text-field";
import { shortTime } from "../../shared/dates";
import type {
  AdminAffiliate,
  AdminAffiliateAttribution,
  AdminAffiliateReferral,
} from "../../../lib/api";

const STATE_LABELS: Record<AdminAffiliateReferral["state"], string> = {
  active: "Active",
  inactive: "Inactive",
  not_activated: "Not Activated",
};

// One attribution row, with the controlled correction form item 5 requires:
// reassignment always carries a reason and is audited.
function ReferralRow({
  referral,
  open,
  onToggle,
  reassignmentTargets,
}: {
  referral: AdminAffiliateReferral;
  open: boolean;
  onToggle: () => void;
  reassignmentTargets: AdminAffiliate[];
}) {
  return (
    <Stack
      spacing={1}
      sx={{ p: 1, borderRadius: 1, bgcolor: "rgba(var(--surface-rgb), 0.76)" }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900 }}>
            {referral.businessName || "Unnamed business"}
            {referral.businessHandle ? ` \u00b7 @${referral.businessHandle}` : ""}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Attributed {shortTime(referral.attributedAt)} {"\u00b7"}{" "}
            {referral.attributionModel.replace("_", " ")}
            {referral.planName ? ` \u00b7 ${referral.planName}` : ""}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            variant="outlined"
            label={STATE_LABELS[referral.state]}
          />
          <Button size="small" onClick={onToggle}>
            {open ? "Cancel" : "Correct"}
          </Button>
        </Stack>
      </Stack>

      {open ? (
        <Form method="post">
          <input
            type="hidden"
            name="intent"
            value="admin-affiliate-attribution:correct"
          />
          <input type="hidden" name="business_id" value={referral.businessId} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              select
              required
              size="small"
              label="Reassign to"
              name="affiliate_id"
              defaultValue=""
              sx={{ minWidth: 200 }}
            >
              {reassignmentTargets.map((candidate) => (
                <MenuItem key={candidate.affiliateId} value={candidate.affiliateId}>
                  {candidate.displayName} {"\u00b7"} {candidate.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              size="small"
              label="Reason (fraud, duplicate, self-referral, error)"
              name="reason"
              sx={{ flex: 1 }}
            />
            <Button type="submit" size="small" variant="outlined">
              Correct attribution
            </Button>
          </Stack>
        </Form>
      ) : null}
    </Stack>
  );
}

export function AffiliateReferralsPanel({
  affiliate,
  performance,
  affiliates,
}: {
  affiliate: AdminAffiliate;
  performance?: AdminAffiliateAttribution;
  affiliates: AdminAffiliate[];
}) {
  const [stateFilter, setStateFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [correcting, setCorrecting] = useState<string | null>(null);

  const referrals = (performance?.referrals ?? []).filter((referral) => {
    const search = query.trim().toLowerCase();
    return (
      (stateFilter === "all" || referral.state === stateFilter) &&
      (!search ||
        [referral.businessName, referral.businessHandle].some((value) =>
          value.toLowerCase().includes(search),
        ))
    );
  });

  const reassignmentTargets = affiliates.filter(
    (candidate) =>
      candidate.status === "active" &&
      candidate.affiliateId !== affiliate.affiliateId,
  );

  return (
    <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Typography variant="h6">Referral attribution</Typography>
      <Typography variant="body2" color="text.secondary">
        Every business attributed to this Affiliate. The attribution stays
        attached even when a business becomes free or inactive and later
        subscribes again.
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1.5 }}>
        <TextField
          size="small"
          label="Business or handle"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          select
          size="small"
          label="State"
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="all">All states</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
          <MenuItem value="not_activated">Not Activated</MenuItem>
        </TextField>
      </Stack>

      {referrals.length ? (
        <Stack spacing={0.75} sx={{ mt: 1.5 }}>
          {referrals.map((referral) => (
            <ReferralRow
              key={referral.signupId}
              referral={referral}
              open={correcting === referral.signupId}
              onToggle={() =>
                setCorrecting(
                  correcting === referral.signupId ? null : referral.signupId,
                )
              }
              reassignmentTargets={reassignmentTargets}
            />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          No referred businesses match this view.
        </Typography>
      )}
    </Box>
  );
}
