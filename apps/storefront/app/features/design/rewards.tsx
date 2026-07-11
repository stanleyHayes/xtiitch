import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import CardGiftcardRounded from "@mui/icons-material/CardGiftcardRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import SecurityRounded from "@mui/icons-material/SecurityRounded";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { ReferralCode } from "../../lib/api";
import type { RewardCodes } from "./types";
import { rewardValueLabel } from "./utils";

type RewardCue = {
  key: string;
  icon: ReactNode;
  label: string;
  detail: string;
  chip: string;
  tone: "success" | "info" | "warning";
};

function rewardCues(
  codes: RewardCodes,
  referralPreview: ReferralCode | null | undefined,
  includePromo: boolean,
): RewardCue[] {
  const cues: RewardCue[] = [];

  if (includePromo && codes.promoCode) {
    cues.push({
      key: "promo",
      icon: <LocalOfferRounded />,
      label: `Promo ${codes.promoCode}`,
      detail:
        "Discounts are checked before Paystack opens and reduce the amount charged when the code qualifies.",
      chip: "Checked at checkout",
      tone: "info",
    });
  }

  if (referralPreview) {
    cues.push({
      key: "referral",
      icon: <CardGiftcardRounded />,
      label: referralPreview.title,
      detail: `Referral preview: ${rewardValueLabel(referralPreview)} referee reward after the qualifying paid order.`,
      chip: "Referral found",
      tone: "success",
    });
  } else if (codes.referralCode) {
    cues.push({
      key: "referral",
      icon: <CardGiftcardRounded />,
      label: `Referral ${codes.referralCode}`,
      detail:
        "We could not preview this referral yet, but checkout will still attempt a non-blocking validation.",
      chip: "Pending validation",
      tone: "warning",
    });
  }

  if (codes.affiliateCode) {
    cues.push({
      key: "affiliate",
      icon: <GroupsRounded />,
      label: `Partner link ${codes.affiliateCode}`,
      detail:
        "Attribution is attached to the order for the partner programme. It does not change the shopper price.",
      chip: codes.affiliateClickID ? "Click recorded" : "Link captured",
      tone: codes.affiliateClickID ? "success" : "info",
    });
  }

  return cues;
}

function rewardTone(tone: RewardCue["tone"]) {
  switch (tone) {
    case "success":
      return tokens.success;
    case "warning":
      return tokens.warning;
    default:
      return tokens.burgundy;
  }
}

export function RewardFields({
  codes,
  referralPreview,
  includePromo = true,
}: {
  codes: RewardCodes;
  referralPreview?: ReferralCode | null;
  includePromo?: boolean;
}) {
  const cues = rewardCues(codes, referralPreview, includePromo);

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "8px",
        bgcolor: alpha(tokens.success, 0.045),
        border: "1px solid",
        borderColor: alpha(tokens.success, 0.14),
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <SecurityRounded sx={{ color: tokens.success }} />
          <Box>
            <Typography sx={{ fontWeight: 950 }}>
              Rewards &amp; codes
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Optional codes are applied before payment; tracking stays private.
            </Typography>
          </Box>
        </Stack>
        {cues.length > 0 ? (
          <Chip
            icon={<VerifiedRounded />}
            label={`${cues.length} active`}
            size="small"
            sx={{
              bgcolor: alpha(tokens.success, 0.1),
              color: tokens.success,
              fontWeight: 900,
              "& .MuiChip-icon": { color: tokens.success },
            }}
          />
        ) : null}
      </Stack>
      <Stack spacing={1.25}>
        {includePromo ? (
          <TextField
            name="promo_code"
            label="Promo code"
            defaultValue={codes.promoCode}
            helperText="Store or platform voucher. The final discount is confirmed at checkout."
            fullWidth
            slotProps={{
              htmlInput: {
                autoCapitalize: "characters",
                spellCheck: false,
              },
            }}
          />
        ) : null}
        <TextField
          name="referral_code"
          label="Referral code"
          defaultValue={codes.referralCode}
          helperText="Use a referral code from the store or Xtiitch programme."
          fullWidth
          slotProps={{
            htmlInput: {
              autoCapitalize: "characters",
              spellCheck: false,
            },
          }}
        />
        <input
          type="hidden"
          name="affiliate_code"
          value={codes.affiliateCode}
        />
        <input
          type="hidden"
          name="affiliate_click_id"
          value={codes.affiliateClickID}
        />
        <input
          type="hidden"
          name="affiliate_visitor_id"
          value={codes.affiliateVisitorID}
        />
        {cues.length > 0 ? (
          <Stack spacing={1}>
            {cues.map((cue) => {
              const tone = rewardTone(cue.tone);
              return (
                <Box
                  key={cue.key}
                  sx={{
                    p: 1.15,
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: alpha(tone, 0.16),
                    bgcolor: alpha(tone, 0.06),
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "flex-start" }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        display: "grid",
                        placeItems: "center",
                        color: tone,
                        bgcolor: alpha(tone, 0.1),
                        flexShrink: 0,
                      }}
                    >
                      {cue.icon}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography sx={{ fontWeight: 950 }}>
                          {cue.label}
                        </Typography>
                        <Chip
                          size="small"
                          label={cue.chip}
                          sx={{
                            height: 22,
                            bgcolor: alpha(tone, 0.1),
                            color: tone,
                            fontWeight: 900,
                          }}
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.35, color: "text.secondary" }}
                      >
                        {cue.detail}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Alert severity="info">
            No code yet. You can leave these blank and still place the order.
          </Alert>
        )}
      </Stack>
    </Box>
  );
}
