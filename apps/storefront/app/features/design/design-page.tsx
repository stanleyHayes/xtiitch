import { useMemo, useState } from "react";
import { useNavigation, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import Button from "@mui/material/Button";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import PointOfSaleRounded from "@mui/icons-material/PointOfSaleRounded";
import SecurityRounded from "@mui/icons-material/SecurityRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import type { Route } from "../../routes/+types/design";
import { priceLabel } from "../../lib/format";
import { formatGHS } from "../../lib/format";

import { tokens } from "../../theme";
import { StoreNotice } from "../storefront/store-notice";
import { BespokeCustomise } from "./bespoke-forms";
import {
  Gallery,
  buildSwatches,
  ColourVariations,
  DEFAULT_SWATCH_ID,
  GALLERY_FALLBACK,
} from "./gallery";
import { RelatedDesigns } from "./related-designs";
import { DetailSignal, SizePriceList } from "./size-price";
import { StandardOrderPanel } from "./standard-order";
import { WaitlistPanel } from "./waitlist";

import { resolveDepositMinor } from "./utils";

export default function DesignPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  if ("notFound" in loaderData) {
    return (
      <StoreNotice
        title="This piece is no longer available"
        message="The design you're looking for has been removed or unpublished. Browse the rest of the store to find something you love."
      />
    );
  }
  const { design } = loaderData;
  const rewardCodes = actionData?.rewardCodes ?? loaderData.rewardCodes;
  const referralPreview = loaderData.referralPreview;
  const visitSlots = loaderData.visitSlots;
  const relatedDesigns = loaderData.relatedDesigns;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const store = design.store;
  const brand = store?.brand_color || tokens.burgundy;
  const storeHref = store?.handle ? `/store/${store.handle}` : "/";
  const depositLabel = store
    ? formatGHS(resolveDepositMinor(design, store))
    : "Deposit";
  const fitRouteLabel = design.customisation_allowed
    ? "Listed size or bespoke"
    : "Listed sizes";

  // Colour variations: the selected swatch drives which image set the gallery
  // shows. Price and order flow are unchanged across variations.
  const swatches = useMemo(() => buildSwatches(design), [design]);
  const [activeSwatchId, setActiveSwatchId] = useState(
    swatches[0]?.id ?? DEFAULT_SWATCH_ID,
  );
  const activeSwatch =
    swatches.find((swatch) => swatch.id === activeSwatchId) ?? swatches[0];
  const activeImages =
    activeSwatch && activeSwatch.images.length > 0
      ? activeSwatch.images
      : design.images;
  const coverImage = activeImages[0] ?? design.images[0] ?? GALLERY_FALLBACK;

  // Made-to-wear is the default view; "Customise" swaps to the bespoke view when
  // the store offers it. A bespoke-only design (no listed sizes) opens straight
  // into the customise view, and a failed bespoke submit reopens it so the error
  // is visible.
  const canCustomise = Boolean(
    store?.handle &&
    design.customisation_allowed &&
    store.settings.bespoke_enabled,
  );
  const [customising, setCustomising] = useState(
    Boolean(actionData?.customError) ||
      (canCustomise && design.prices.length === 0),
  );
  const priceHeadline = customising ? depositLabel : priceLabel(design.prices);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(brand, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(brand, 0.035)} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        "@keyframes storeSurfaceIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "1ms !important",
            transitionDuration: "1ms !important",
          },
        },
      }}
    >
      <Container sx={{ py: { xs: 3, md: 5 } }}>
        <Link
          component={RouterLink}
          to={storeHref}
          underline="hover"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            mb: 3,
            color: "text.secondary",
          }}
        >
          <ArrowBackRounded fontSize="small" /> Back to{" "}
          {store?.name ?? "the store"}
        </Link>

        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, lg: 4 },
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.95fr) 1.05fr" },
            alignItems: "start",
          }}
        >
          <Gallery key={activeSwatchId} design={design} images={activeImages} />

          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                p: { xs: 2.25, md: 3 },
                borderRadius: "8px",
                bgcolor: "rgba(var(--surface-rgb), 0.92)",
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.08),
                boxShadow: `0 18px 60px ${alpha(tokens.ink, 0.08)}`,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap", mb: 1.5 }}
              >
                {store ? (
                  <Chip
                    icon={<StorefrontRounded />}
                    label={store.name}
                    sx={{
                      bgcolor: alpha(brand, 0.08),
                      color: brand,
                      fontWeight: 900,
                      "& .MuiChip-icon": { color: brand },
                    }}
                  />
                ) : null}
                <Chip
                  icon={<SecurityRounded />}
                  label="Secure Xtiitch checkout"
                  sx={{
                    bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08),
                    color: "text.primary",
                    fontWeight: 900,
                    "& .MuiChip-icon": { color: "text.primary" },
                  }}
                />
              </Stack>

              <Typography variant="h3" component="h1">
                {design.title}
              </Typography>
              <Typography
                variant="h5"
                sx={{ mt: 1, color: "primary.main", fontWeight: 900 }}
              >
                {priceHeadline}
              </Typography>

              {design.description ? (
                <Typography
                  sx={{
                    mt: 2.25,
                    color: "text.secondary",
                    whiteSpace: "pre-line",
                    fontSize: { md: 17 },
                  }}
                >
                  {design.description}
                </Typography>
              ) : null}

              {/* Only one price type is ever shown: the listed price on the
                  default made-to-wear view, or the bespoke deposit once the
                  customise view is open — never both. */}
              <Box
                sx={{
                  mt: 2.5,
                  display: "grid",
                  gap: 1.25,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                  },
                }}
              >
                {customising ? (
                  <DetailSignal
                    icon={<PointOfSaleRounded />}
                    label="Deposit"
                    value={depositLabel}
                  />
                ) : (
                  <DetailSignal
                    icon={<CreditCardRounded />}
                    label="Price"
                    value={priceLabel(design.prices)}
                  />
                )}
                <DetailSignal
                  icon={<StraightenRounded />}
                  label="Fit route"
                  value={fitRouteLabel}
                />
              </Box>

              <ColourVariations
                swatches={swatches}
                activeId={activeSwatchId}
                onSelect={setActiveSwatchId}
                brand={brand}
              />

              {customising ? (
                <Box sx={{ mt: 2.5 }}>
                  <Button
                    type="button"
                    variant="text"
                    startIcon={<ArrowBackRounded />}
                    onClick={() => setCustomising(false)}
                    sx={{ px: 0, fontWeight: 800, color: "text.secondary" }}
                  >
                    Back to standard sizes
                  </Button>
                </Box>
              ) : (
                <Box sx={{ mt: 2.5 }}>
                  <SizePriceList design={design} />
                  {canCustomise ? (
                    <Button
                      type="button"
                      variant="outlined"
                      fullWidth
                      startIcon={<StraightenRounded />}
                      onClick={() => setCustomising(true)}
                      sx={{ mt: 2, fontWeight: 900 }}
                    >
                      Customise this piece
                    </Button>
                  ) : null}
                </Box>
              )}
            </Box>

            <Box sx={{ mt: 2 }}>
              {customising ? (
                <BespokeCustomise
                  design={design}
                  store={store}
                  isSubmitting={isSubmitting}
                  error={actionData?.customError}
                  rewardCodes={rewardCodes}
                  referralPreview={referralPreview}
                  visitSlots={visitSlots}
                  coverImage={coverImage}
                />
              ) : (
                <StandardOrderPanel
                  design={design}
                  store={store}
                  isSubmitting={isSubmitting}
                  error={actionData?.standardError}
                  rewardCodes={rewardCodes}
                  referralPreview={referralPreview}
                  coverImage={coverImage}
                />
              )}
            </Box>
            <WaitlistPanel
              store={store}
              design={design}
              isSubmitting={isSubmitting}
              error={actionData?.waitlistError}
              success={actionData?.waitlistSuccess}
            />
          </Box>
        </Box>
        <RelatedDesigns designs={relatedDesigns} store={store} />
      </Container>
    </Box>
  );
}
