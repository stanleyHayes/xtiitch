import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { Design } from "../../lib/api";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { CollectionSummary } from "../shared/types";
import { fallbackDesignImage } from "../shared/utils";
import { CopyLinkButton } from "./CopyLinkButton";
import { ToneChip } from "../../components/ui/ToneChip";

export function DesignCard({
  design,
  collections,
  storeHandle,
  onOpen,
}: {
  design: Design;
  collections: CollectionSummary[];
  storeHandle: string;
  onOpen: () => void;
}) {
  const retired = design.status === "retired";
  const image = design.images[0] || fallbackDesignImage(design);
  const collectionName =
    collections.find(
      (collection) => collection.collection_id === design.collection_id,
    )?.name ?? "No collection";
  const lowestPriceMinor = design.prices.reduce<number | null>(
    (lowest, price) =>
      lowest === null ? price.price_minor : Math.min(lowest, price.price_minor),
    null,
  );
  const priceSummary =
    lowestPriceMinor === null
      ? "No prices"
      : design.prices.length === 1
        ? formatGHS(lowestPriceMinor)
        : `From ${formatGHS(lowestPriceMinor)}`;
  const shareUrl = `https://${storeHandle}.xtiitch.com/design/${design.handle}`;
  return (
    <Box sx={{ position: "relative", display: "flex", minHeight: "100%" }}>
      <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
        <CopyLinkButton url={shareUrl} label="Copy design link" />
      </Box>
      <ButtonBase
        onClick={onOpen}
        aria-label={`Open ${design.title}`}
        sx={{
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          width: "100%",
          minHeight: "100%",
          border: "1px solid",
          borderColor: alpha(tokens.ink, 0.1),
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.paper",
          opacity: retired ? 0.62 : 1,
          transition:
            "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            borderColor: alpha(tokens.burgundy, 0.3),
            boxShadow: `0 18px 40px ${alpha(tokens.ink, 0.1)}`,
          },
          "&:focus-visible": {
            outline: `2px solid ${tokens.burgundy}`,
            outlineOffset: 2,
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            aspectRatio: "4 / 3",
            bgcolor: alpha(tokens.burgundy, 0.06),
          }}
        >
          <Box
            component="img"
            src={image}
            alt=""
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: design.images[0]
                ? "none"
                : "saturate(0.9) contrast(1.04)",
            }}
          />
          <Box sx={{ position: "absolute", top: 8, left: 8 }}>
            <ToneChip
              label={design.status}
              tone={retired ? tokens.mutedText : tokens.success}
            />
          </Box>
        </Box>
        <Box
          sx={{
            p: 1.5,
            minWidth: 0,
            display: "flex",
            flex: 1,
            flexDirection: "column",
          }}
        >
          <Typography sx={{ fontWeight: 800 }} noWrap>
            {design.title}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block" }}
            noWrap
          >
            {collectionName}
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              mt: "auto",
              pt: 1,
              alignItems: "center",
              flexWrap: "wrap",
              gap: 0.5,
            }}
          >
            <Chip size="small" variant="outlined" label={priceSummary} />
            {design.customisation_allowed ? (
              <Chip size="small" variant="outlined" label="Bespoke" />
            ) : null}
            {design.customisation_allowed &&
            (design.bespoke_display_minor ?? 0) > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                label={`From ${formatGHS(design.bespoke_display_minor ?? 0)}`}
              />
            ) : null}
          </Stack>
        </Box>
      </ButtonBase>
    </Box>
  );
}