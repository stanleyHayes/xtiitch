import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import type { Design } from "../../lib/api";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { BusinessPromotion, CollectionSummary } from "../shared/types";
import { promotionStatusTone, promotionDiscountLabel, promotionTargetLabel, promotionScopeLabel, promotionWindowLabel } from "./utils";
import { ToneChip } from "../../components/ui/ToneChip";

export function PromotionRow({
  promotion,
  collections,
  designs,
  onView,
}: {
  promotion: BusinessPromotion;
  collections: CollectionSummary[];
  designs: Design[];
  onView: () => void;
}) {
  return (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 1.6,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack spacing={1.35}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.4}
          sx={{
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.15} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                bgcolor: alpha(promotionStatusTone(promotion.status), 0.1),
                color: promotionStatusTone(promotion.status),
                border: "1px solid",
                borderColor: alpha(promotionStatusTone(promotion.status), 0.2),
              }}
            >
              <LocalOfferRounded />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 950 }} noWrap>
                {promotion.code}
              </Typography>
              <Typography sx={{ fontWeight: 800 }} noWrap>
                {promotion.title}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {promotionDiscountLabel(promotion)} ·{" "}
                {promotionTargetLabel(promotion, collections, designs)}
              </Typography>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ mt: 0.85, flexWrap: "wrap" }}
              >
                <ToneChip
                  label={promotion.status}
                  tone={promotionStatusTone(promotion.status)}
                />
                <ToneChip
                  label={promotionScopeLabel(promotion)}
                  tone={tokens.info}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={promotionWindowLabel(promotion)}
                />
              </Stack>
            </Box>
          </Stack>
          <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {promotion.redemption_count} redemption
              {promotion.redemption_count === 1 ? "" : "s"}
            </Typography>
            <Typography sx={{ fontWeight: 900 }}>
              {formatGHS(promotion.discount_redeemed_minor)}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<VisibilityRounded />}
              onClick={onView}
              sx={{ mt: 1 }}
            >
              View details
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}