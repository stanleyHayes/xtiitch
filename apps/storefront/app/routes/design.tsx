import {
  Form,
  Link as RouterLink,
  data,
  redirect,
  useNavigation,
} from "react-router";
import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import HomeWorkRounded from "@mui/icons-material/HomeWorkRounded";
import PointOfSaleRounded from "@mui/icons-material/PointOfSaleRounded";
import SecurityRounded from "@mui/icons-material/SecurityRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import CardGiftcardRounded from "@mui/icons-material/CardGiftcardRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import type { Route } from "./+types/design";
import {
  api,
  type AvailabilitySlot,
  type CustomSizeMode,
  type Design,
  type DesignVariation,
  type ReferralCode,
  type StoreSummary,
} from "../lib/api";
import { formatGHS, priceLabel } from "../lib/format";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import { addToCart } from "../lib/cart";
import { getSession } from "../lib/session";
import TextField from "../components/form-text-field";
import { tokens } from "../theme";
import { DesignCard, StoreNotice } from "../components/storefront";

type RewardCodes = {
  promoCode: string;
  referralCode: string;
  affiliateCode: string;
  affiliateClickID: string;
  affiliateVisitorID: string;
};

export async function loader({ params, request }: Route.LoaderArgs) {
  const design = await api.design(params.handle);
  if (!design) {
    // Deleted or unpublished: render a friendly in-store notice (below) rather
    // than a hard error page. The 404 status keeps it out of search results.
    return data({ notFound: true } as const, { status: 404 });
  }
  const rewardCodes = await rewardCodesFromRequest(request);
  const availabilityRange = availabilityRangeForRequest();
  const [referralPreview, availability, storePage] = await Promise.all([
    rewardCodes.referralCode
      ? api.referral(rewardCodes.referralCode).catch(() => null)
      : Promise.resolve(null),
    design.store?.handle &&
    design.customisation_allowed &&
    design.store.settings.bespoke_enabled
      ? api
          .availability(design.store.handle, availabilityRange)
          .catch(() => null)
      : Promise.resolve(null),
    design.store?.handle
      ? api.store(design.store.handle).catch(() => null)
      : Promise.resolve(null),
  ]);
  return {
    design,
    rewardCodes,
    referralPreview,
    visitSlots: availability?.slots ?? [],
    relatedDesigns: relatedDesignsFor(design, storePage?.designs ?? []),
  };
}

function availabilityRangeForRequest() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 28);
  return { from: from.toISOString(), to: to.toISOString() };
}

function relatedDesignsFor(current: Design, designs: Design[]): Design[] {
  const sameCollection = (design: Design) =>
    Boolean(current.collection_id) &&
    design.collection_id === current.collection_id;

  return designs
    .filter(
      (design) =>
        design.design_id !== current.design_id &&
        design.handle !== current.handle,
    )
    .sort((a, b) => {
      const collectionDelta =
        Number(sameCollection(b)) - Number(sameCollection(a));
      if (collectionDelta !== 0) {
        return collectionDelta;
      }
      return a.sequence - b.sequence || a.title.localeCompare(b.title);
    })
    .slice(0, 3);
}

export function meta({ data: loaded }: Route.MetaArgs) {
  const design = loaded && "design" in loaded ? loaded.design : null;
  if (!design) {
    return [
      { title: "Piece unavailable · Xtiitch" },
      { name: "robots", content: "noindex" },
    ];
  }
  const title = design.title;
  return [
    { title: `${title} · Xtiitch` },
    {
      name: "description",
      content: design.description || `View ${title} on Xtiitch.`,
    },
  ];
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "standard");
  const storeHandle = String(form.get("store_handle") ?? "").trim();
  const customerName = String(form.get("customer_name") ?? "").trim();
  const customerPhone = String(form.get("customer_phone") ?? "").trim();
  const customerEmail = String(form.get("customer_email") ?? "").trim();
  const method =
    String(form.get("method") ?? "momo") === "card" ? "card" : "momo";
  const rewardCodes = rewardCodesFromForm(form);

  if (intent === "add_to_cart" || intent === "buy_now") {
    const designHandle = params.handle ?? "";
    const title = String(form.get("title") ?? "").trim();
    const image = String(form.get("image") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    const kind =
      String(form.get("kind") ?? "made_to_wear") === "bespoke"
        ? "bespoke"
        : "made_to_wear";
    if (!storeHandle || !designHandle || !title) {
      return actionFailure(
        rewardCodes,
        "Could not add that to your cart.",
        null,
      );
    }
    let sizeBandID = "";
    let sizeLabel: string;
    let sizeMode: "self_measure" | "home_visit" | "come_to_shop" | undefined;
    let measurements: Record<string, string> | undefined;
    let amountMinor: number;
    if (kind === "bespoke") {
      sizeMode =
        toCustomSizeMode(String(form.get("size_mode") ?? "")) ?? undefined;
      if (sizeMode !== "self_measure") {
        return actionFailure(
          rewardCodes,
          null,
          "Only self-measure bespoke deposits can be added to cart. Use the visit or shop route separately.",
        );
      }
      measurements = collectMeasurements(form);
      if (Object.keys(measurements).length === 0) {
        return actionFailure(
          rewardCodes,
          null,
          "Add at least one measurement before adding this bespoke deposit to cart.",
        );
      }
      amountMinor =
        Number.parseInt(String(form.get("deposit_minor") ?? "0"), 10) || 0;
      sizeLabel = "Self-measure deposit";
    } else {
      sizeBandID = String(form.get("size_band_id") ?? "").trim();
      try {
        const bands = JSON.parse(String(form.get("bands_json") ?? "[]")) as {
          size_band_id: string;
          label: string;
          price_minor: number;
        }[];
        const band = bands.find((entry) => entry.size_band_id === sizeBandID);
        if (!band) {
          return actionFailure(
            rewardCodes,
            "Choose a size before adding to cart.",
            null,
          );
        }
        sizeLabel = band.label;
        amountMinor = band.price_minor;
      } catch {
        return actionFailure(
          rewardCodes,
          "Could not add that to your cart.",
          null,
        );
      }
    }
    const cookie = await addToCart(request, {
      store_handle: storeHandle,
      design_handle: designHandle,
      title,
      image,
      kind,
      size_band_id: sizeBandID,
      size_label: sizeLabel,
      amount_minor: amountMinor,
      size_mode: sizeMode,
      measurements,
      note: note || undefined,
    });
    // Pay Now takes the shopper straight to checkout (where personal details are
    // collected); Add to Cart lands on the cart. Neither collects contact here.
    const destination = intent === "buy_now" ? "/checkout" : "/cart";
    return redirect(destination, { headers: { "Set-Cookie": cookie } });
  }

  if (intent === "waitlist") {
    const contact = String(form.get("customer_contact") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    if (!storeHandle || !customerName || !contact) {
      return {
        customError: null,
        rewardCodes,
        standardError: null,
        waitlistError: "Add your name and a phone number or email.",
        waitlistSuccess: false,
      };
    }
    const response = await api.joinWaitlist(storeHandle, params.handle, {
      customer_name: customerName,
      customer_contact: contact,
      note,
    });
    if (!response.ok) {
      return {
        customError: null,
        rewardCodes,
        standardError: null,
        waitlistError:
          response.status === 409
            ? "This store is not taking waiting-list sign-ups right now."
            : "Could not join the waiting list. Please try again.",
        waitlistSuccess: false,
      };
    }
    return {
      customError: null,
      rewardCodes,
      standardError: null,
      waitlistError: null as string | null,
      waitlistSuccess: true,
    };
  }

  if (intent === "custom") {
    // §3b: taking a bespoke deposit is a payment, so it needs a verified
    // customer session too. Send guests to sign in and back to this design.
    const session = await getSession(request.headers.get("Cookie"));
    if (!session.get("customerToken")) {
      return redirect(
        `/account?redirectTo=/d/${encodeURIComponent(params.handle ?? "")}`,
      );
    }
    const sizeMode = toCustomSizeMode(String(form.get("size_mode") ?? ""));
    const note = String(form.get("note") ?? "").trim();
    if (!storeHandle || !sizeMode || !customerName || !customerEmail) {
      return actionFailure(
        rewardCodes,
        null,
        "Choose a bespoke route and add your name and email.",
      );
    }

    if (sizeMode === "home_visit") {
      const slotStart = String(form.get("slot_start") ?? "").trim();
      const address = String(form.get("address") ?? "").trim();
      if (!slotStart || !address) {
        return actionFailure(
          rewardCodes,
          null,
          "Choose a visit slot and add the visit address.",
        );
      }

      const response = await api.placeBooking(storeHandle, {
        design_handle: params.handle,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        method,
        ...attributionPayload(rewardCodes),
        slot_start: slotStart,
        address,
        note: note || undefined,
      });

      if (!response.ok) {
        return actionFailure(
          rewardCodes,
          null,
          customOrderMessage(response.error),
        );
      }

      if (response.result.authorization_url) {
        return redirect(response.result.authorization_url);
      }
      return redirect(`/track/${response.result.order_id}`);
    }

    const measurements = collectMeasurements(form);
    if (sizeMode === "self_measure" && Object.keys(measurements).length === 0) {
      return actionFailure(
        rewardCodes,
        null,
        "Add at least one self-measurement before paying the deposit.",
      );
    }

    const response = await api.placeCustomOrder(storeHandle, {
      design_handle: params.handle,
      size_mode: sizeMode,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      method: sizeMode === "come_to_shop" ? undefined : method,
      ...rewardPayload(rewardCodes),
      measurements: sizeMode === "self_measure" ? measurements : undefined,
      note: note || undefined,
    });

    if (!response.ok) {
      return actionFailure(
        rewardCodes,
        null,
        customOrderMessage(response.error),
      );
    }

    if (response.result.authorization_url) {
      return redirect(response.result.authorization_url);
    }
    return redirect(`/track/${response.result.order_id}`);
  }

  // Made-to-wear and self-measure bespoke buys now flow through the cart (the
  // add_to_cart / buy_now branch above); nothing else should reach here.
  return actionFailure(
    rewardCodes,
    "Something went wrong. Please try again.",
    null,
  );
}

function actionFailure(
  rewardCodes: RewardCodes,
  standardError: string | null,
  customError: string | null,
) {
  return {
    customError,
    rewardCodes,
    standardError,
    waitlistError: null as string | null,
    waitlistSuccess: false,
  };
}

function toCustomSizeMode(value: string): CustomSizeMode | null {
  if (
    value === "self_measure" ||
    value === "home_visit" ||
    value === "come_to_shop"
  ) {
    return value;
  }
  return null;
}

function collectMeasurements(form: FormData): Record<string, string> {
  const measurements: Record<string, string> = {};
  for (const rawFieldID of form.getAll("measurement_field_id")) {
    const fieldID = String(rawFieldID).trim();
    const value = String(form.get(`measurement_${fieldID}`) ?? "").trim();
    if (fieldID && value) {
      measurements[fieldID] = value;
    }
  }
  return measurements;
}

function cleanRewardCode(value: FormDataEntryValue | string | null): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

async function rewardCodesFromRequest(request: Request): Promise<RewardCodes> {
  const url = new URL(request.url);
  const codes = {
    promoCode: cleanRewardCode(
      url.searchParams.get("promo_code") ?? url.searchParams.get("promo"),
    ),
    referralCode: cleanRewardCode(
      url.searchParams.get("referral_code") ??
        url.searchParams.get("referral") ??
        url.searchParams.get("ref"),
    ),
    affiliateCode: cleanRewardCode(
      url.searchParams.get("affiliate_code") ??
        url.searchParams.get("affiliate"),
    ),
    affiliateClickID: String(
      url.searchParams.get("affiliate_click_id") ??
        url.searchParams.get("click_id") ??
        "",
    ).trim(),
    affiliateVisitorID: String(
      url.searchParams.get("affiliate_visitor_id") ??
        url.searchParams.get("visitor_id") ??
        "",
    ).trim(),
  };

  if (!codes.affiliateCode || codes.affiliateClickID) {
    return codes;
  }

  const visitorID = codes.affiliateVisitorID || newAffiliateVisitorID();
  const response = await api
    .recordAffiliateClick(codes.affiliateCode, {
      visitor_id: visitorID,
      landing_url: request.url,
      referrer_url: request.headers.get("referer") ?? "",
    })
    .catch(() => null);

  return {
    ...codes,
    affiliateClickID: response?.ok ? response.result.click_id : "",
    affiliateVisitorID: visitorID,
  };
}

function rewardCodesFromForm(form: FormData): RewardCodes {
  return {
    promoCode: cleanRewardCode(form.get("promo_code")),
    referralCode: cleanRewardCode(form.get("referral_code")),
    affiliateCode: cleanRewardCode(form.get("affiliate_code")),
    affiliateClickID: String(form.get("affiliate_click_id") ?? "").trim(),
    affiliateVisitorID: String(form.get("affiliate_visitor_id") ?? "").trim(),
  };
}

function rewardPayload(codes: RewardCodes) {
  return {
    promo_code: codes.promoCode || undefined,
    ...attributionPayload(codes),
  };
}

function attributionPayload(codes: RewardCodes) {
  return {
    referral_code: codes.referralCode || undefined,
    affiliate_code: codes.affiliateCode || undefined,
    affiliate_click_id: codes.affiliateClickID || undefined,
    affiliate_visitor_id: codes.affiliateVisitorID || undefined,
  };
}

function customOrderMessage(code: string): string {
  switch (code) {
    case "store_not_verified":
      return "This store needs to finish payment verification before it can take deposit payments.";
    case "store_cannot_take_order":
      return "This store has not enabled this bespoke order route yet.";
    case "promotion_unavailable":
      return "That promo code is not available for this bespoke request. Check the code, remove it, or try a different reward.";
    case "slot_unavailable":
      return "That home-visit slot is no longer available. Pick another open slot.";
    case "invalid_order":
      return "Check the bespoke route, contact details, and measurements, then try again.";
    case "not_found":
      return "This design is not available for bespoke orders right now.";
    default:
      return "The bespoke order could not start. Please try again shortly.";
  }
}

function newAffiliateVisitorID(): string {
  const randomID = globalThis.crypto?.randomUUID?.();
  if (randomID) {
    return `xtv_${randomID}`;
  }
  return `xtv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function Gallery({
  design,
  images: variationImages,
}: {
  design: Design;
  images: string[];
}) {
  const fallback = "/images/storefront-atelier-review.webp";
  const images = variationImages.length > 0 ? variationImages : [fallback];
  const [cover, setCover] = useState(images[0] ?? fallback);
  const hasUploadedCover = variationImages.includes(cover);
  return (
    <Box sx={{ position: { lg: "sticky" }, top: { lg: 24 } }}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "8px",
          border: "1px solid",
          borderColor: alpha(tokens.ink, 0.08),
          boxShadow: `0 24px 70px ${alpha(tokens.ink, 0.12)}`,
          bgcolor: "background.paper",
        }}
      >
        <Box
          component="img"
          src={cover}
          alt={
            hasUploadedCover
              ? design.title
              : `Studio preview for ${design.title}`
          }
          sx={{
            width: "100%",
            aspectRatio: "4 / 5",
            objectFit: "cover",
            display: "block",
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: "auto 0 0",
            height: "34%",
            background: `linear-gradient(0deg, ${alpha(tokens.ink, 0.52)}, transparent)`,
          }}
        />
        <Stack
          direction="row"
          spacing={1}
          sx={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 14,
            flexWrap: "wrap",
          }}
        >
          <Chip
            icon={<CreditCardRounded />}
            label={priceLabel(design.prices)}
            sx={{
              bgcolor: "rgba(var(--surface-rgb), 0.92)",
              color: "text.primary",
              fontWeight: 900,
              backdropFilter: "blur(10px)",
              "& .MuiChip-icon": { color: tokens.burgundy },
            }}
          />
          {design.customisation_allowed ? (
            <Chip
              icon={<StraightenRounded />}
              label="Custom fit available"
              sx={{
                bgcolor: alpha(tokens.ink, 0.78),
                color: tokens.white,
                fontWeight: 900,
                backdropFilter: "blur(10px)",
                "& .MuiChip-icon": { color: tokens.white },
              }}
            />
          ) : null}
        </Stack>
      </Box>
      {images.length > 1 ? (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexWrap: "wrap" }}>
          {images.slice(0, 5).map((src, index) => {
            const selected = src === cover;
            return (
              <Box
                key={src}
                component="button"
                type="button"
                onClick={() => setCover(src)}
                aria-label={`Show ${design.title} image ${index + 1}`}
                sx={{
                  width: 72,
                  height: 90,
                  p: 0,
                  border: "2px solid",
                  borderColor: selected ? tokens.burgundy : "transparent",
                  bgcolor: "transparent",
                  cursor: "pointer",
                  borderRadius: 1.5,
                  overflow: "hidden",
                  boxShadow: selected
                    ? `0 0 0 3px ${alpha(tokens.burgundy, 0.14)}`
                    : "none",
                }}
              >
                <Box
                  component="img"
                  src={src}
                  alt=""
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      ) : null}
    </Box>
  );
}

const DEFAULT_SWATCH_ID = "__default__";
const GALLERY_FALLBACK = "/images/storefront-atelier-review.webp";

type ColourSwatch = {
  id: string;
  label: string;
  thumb: string;
  images: string[];
};

// Builds the colour-swatch list: the design's own photos as the first ("default")
// swatch, then each non-default variation ordered by sequence. Variations share
// the design's price and order flow; only the gallery images differ.
function buildSwatches(design: Design): ColourSwatch[] {
  const base: ColourSwatch = {
    id: DEFAULT_SWATCH_ID,
    label: "Original",
    thumb: design.images[0] ?? GALLERY_FALLBACK,
    images: design.images,
  };
  const variations = (design.variations ?? [])
    .filter((variation) => !variation.is_default)
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((variation: DesignVariation) => ({
      id: variation.variation_id,
      label: variation.name,
      thumb: variation.images[0] ?? design.images[0] ?? GALLERY_FALLBACK,
      images: variation.images.length > 0 ? variation.images : design.images,
    }));
  return [base, ...variations];
}

function ColourVariations({
  swatches,
  activeId,
  onSelect,
  brand,
}: {
  swatches: ColourSwatch[];
  activeId: string;
  onSelect: (id: string) => void;
  brand: string;
}) {
  // Nothing to switch between when the design only has its default images.
  if (swatches.length <= 1) {
    return null;
  }
  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 900 }}>
        Colour variations
      </Typography>
      <Stack
        direction="row"
        spacing={1.25}
        sx={{ flexWrap: "wrap", rowGap: 1.25 }}
      >
        {swatches.map((swatch) => {
          const selected = swatch.id === activeId;
          return (
            <Stack
              key={swatch.id}
              spacing={0.5}
              sx={{ alignItems: "center", width: 72 }}
            >
              <Box
                component="button"
                type="button"
                onClick={() => onSelect(swatch.id)}
                aria-label={`Show ${swatch.label} images`}
                aria-pressed={selected}
                sx={{
                  width: 72,
                  height: 90,
                  p: 0,
                  border: "2px solid",
                  borderColor: selected ? brand : alpha(tokens.ink, 0.12),
                  bgcolor: "transparent",
                  cursor: "pointer",
                  borderRadius: 1.5,
                  overflow: "hidden",
                  boxShadow: selected
                    ? `0 0 0 3px ${alpha(brand, 0.16)}`
                    : "none",
                }}
              >
                <Box
                  component="img"
                  src={swatch.thumb}
                  alt=""
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  maxWidth: 72,
                  fontWeight: selected ? 900 : 600,
                  color: selected ? "text.primary" : "text.secondary",
                }}
              >
                {swatch.label}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

function resolveDepositMinor(design: Design, store: StoreSummary): number {
  return design.deposit_override_minor ?? store.default_deposit_minor;
}

function ContactFields() {
  return (
    <>
      <TextField
        name="customer_name"
        label="Full name"
        required
        fullWidth
        autoComplete="name"
      />
      <TextField
        name="customer_phone"
        label="Phone"
        fullWidth
        autoComplete="tel"
      />
      <TextField
        name="customer_email"
        label="Email"
        type="email"
        required
        fullWidth
        autoComplete="email"
      />
    </>
  );
}

// A free-text note the shopper can leave for the store. Present on the made-to-
// wear order and on all three bespoke options.
function NoteField() {
  return (
    <TextField
      name="note"
      label="Note for the store (optional)"
      placeholder="Colour, fabric, timing, or any special request…"
      fullWidth
      multiline
      minRows={2}
    />
  );
}

function LoadingButtonLabel({ label }: { label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.85,
        "@keyframes xtiitchButtonDot": {
          "0%, 80%, 100%": { opacity: 0.42, transform: "translateY(0)" },
          "40%": { opacity: 1, transform: "translateY(-4px)" },
        },
      }}
    >
      <Box component="span">{label}</Box>
      <Box
        component="span"
        aria-hidden
        sx={{ display: "inline-flex", gap: 0.45, pt: "2px" }}
      >
        {["0ms", "120ms", "240ms"].map((delay) => (
          <Box
            key={delay}
            component="span"
            sx={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              bgcolor: "currentColor",
              animation: `xtiitchButtonDot 900ms ease-in-out ${delay} infinite`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function rewardValueLabel(referral: ReferralCode): string {
  if (referral.reward_type === "percentage") {
    return `${(referral.reward_value / 100).toFixed(0)}%`;
  }
  return formatGHS(referral.reward_value);
}

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

function RewardFields({
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

function SizePriceList({ design }: { design: Design }) {
  if (design.prices.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 900 }}>
        Sizes &amp; prices
      </Typography>
      <Stack
        divider={<Divider />}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "8px",
          overflow: "hidden",
          bgcolor: "rgba(var(--surface-rgb), 0.72)",
        }}
      >
        {design.prices.map((price) => {
          const chart = price.chart ?? [];
          return (
            <Box key={price.size_band_id} sx={{ px: 2, py: 1.25 }}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", gap: 2 }}
              >
                <Typography>{price.label}</Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {formatGHS(price.price_minor)}
                </Typography>
              </Stack>
              {chart.length > 0 ? (
                <Stack
                  direction="row"
                  sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.75 }}
                >
                  {chart.map((item, index) => (
                    <Box
                      key={index}
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: "6px",
                        border: "1px solid",
                        borderColor: "divider",
                        fontSize: 12,
                        color: "text.secondary",
                      }}
                    >
                      {item.name}: {item.value} {item.unit}
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

function DetailSignal({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.1}
      sx={{
        alignItems: "center",
        p: 1.25,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        bgcolor: "rgba(var(--surface-rgb), 0.72)",
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "8px",
          display: "grid",
          placeItems: "center",
          color: tokens.burgundy,
          bgcolor: alpha(tokens.burgundy, 0.08),
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 900 }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 900 }} noWrap>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function StandardOrderPanel({
  design,
  store,
  isSubmitting,
  error,
  rewardCodes,
  referralPreview,
  coverImage,
}: {
  design: Design;
  store?: StoreSummary;
  isSubmitting: boolean;
  error?: string | null;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  coverImage: string;
}) {
  const onlineOrderingEnabled = store?.online_ordering_enabled !== false;
  const canOrder =
    design.prices.length > 0 && Boolean(store?.handle) && onlineOrderingEnabled;

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.14),
        borderRadius: "8px",
        bgcolor: "background.paper",
        boxShadow: `0 18px 48px ${alpha(tokens.ink, 0.08)}`,
      }}
    >
      <Stack direction="row" spacing={1.2} sx={{ alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            color: tokens.white,
            bgcolor: tokens.burgundy,
            flexShrink: 0,
          }}
        >
          <CreditCardRounded />
        </Box>
        <Box>
          <Typography variant="h6">Order a listed size</Typography>
        </Box>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}
      {!canOrder ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {!onlineOrderingEnabled
            ? `${store?.name ?? "This shop"} isn't taking online orders here yet — reach out to the shop directly to place an order.`
            : "This design needs a listed size and store connection before it can be ordered online."}
        </Alert>
      ) : (
        <Form method="post">
          <input
            type="hidden"
            name="store_handle"
            value={store?.handle ?? ""}
          />
          <input type="hidden" name="title" value={design.title} />
          <input type="hidden" name="image" value={coverImage} />
          <input type="hidden" name="kind" value="made_to_wear" />
          <input
            type="hidden"
            name="bands_json"
            value={JSON.stringify(
              design.prices.map((price) => ({
                size_band_id: price.size_band_id,
                label: price.label,
                price_minor: price.price_minor,
              })),
            )}
          />
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <TextField
              select
              name="size_band_id"
              label="Size"
              defaultValue={design.prices[0]?.size_band_id ?? ""}
              required
              fullWidth
            >
              {design.prices.map((price) => (
                <MenuItem key={price.size_band_id} value={price.size_band_id}>
                  {price.label} · {formatGHS(price.price_minor)}
                </MenuItem>
              ))}
            </TextField>
            <NoteField />
            <RewardFields
              codes={rewardCodes}
              referralPreview={referralPreview}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                type="submit"
                name="intent"
                value="add_to_cart"
                formNoValidate
                variant="outlined"
                size="large"
                startIcon={<ShoppingBagRounded />}
                sx={{ flex: 1 }}
              >
                Add to cart
              </Button>
              <Button
                type="submit"
                name="intent"
                value="buy_now"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                sx={{
                  flex: 1,
                  "&.Mui-disabled": {
                    bgcolor: tokens.burgundy,
                    color: tokens.white,
                    opacity: 0.72,
                  },
                }}
              >
                {isSubmitting ? (
                  <LoadingButtonLabel label="Opening checkout" />
                ) : (
                  "Pay now"
                )}
              </Button>
            </Stack>
          </Stack>
        </Form>
      )}
    </Box>
  );
}

type CustomRoute = {
  mode: CustomSizeMode;
  title: string;
  helper: string;
  icon: ReactNode;
  enabled: boolean;
  disabledReason?: string;
  takesPayment: boolean;
  showMeasurements: boolean;
  buttonLabel: string;
};

function customRoutes(
  store: StoreSummary,
  depositLabel: string,
  visitSlots: AvailabilitySlot[],
): CustomRoute[] {
  const measurementFields = store.measurement_fields;

  const routes: CustomRoute[] = [
    {
      mode: "self_measure",
      title: "Self-measure",
      helper: `Send the fit details you already have and pay the ${depositLabel} bespoke deposit.`,
      icon: <StraightenRounded />,
      enabled:
        store.settings.measurements_enabled && measurementFields.length > 0,
      disabledReason: !store.settings.measurements_enabled
        ? "Self-measure is not enabled for this store yet."
        : "This store needs to add measurement fields first.",
      takesPayment: true,
      showMeasurements: true,
      buttonLabel: "Pay bespoke deposit",
    },
    {
      mode: "home_visit",
      title: "Home visit",
      helper: `Pick an open visit slot, pay the ${depositLabel} deposit, then the store captures measurements at the address.`,
      icon: <HomeWorkRounded />,
      enabled: visitSlots.length > 0,
      disabledReason:
        "No home-visit slots are open for the next four weeks. Try self-measure or come to the shop.",
      takesPayment: true,
      showMeasurements: false,
      buttonLabel: "Pay visit deposit",
    },
    {
      mode: "come_to_shop",
      title: "Come to the shop",
      helper:
        "Reserve the request now, then visit the store for measurement and payment arrangements.",
      icon: <StorefrontRounded />,
      enabled: true,
      takesPayment: false,
      showMeasurements: false,
      buttonLabel: "Reserve shop measurement",
    },
  ];

  // Online ordering is a paid plan benefit; without it every custom route is
  // closed and customers are pointed to the shop directly.
  if (store.online_ordering_enabled === false) {
    return routes.map((route) => ({
      ...route,
      enabled: false,
      disabledReason: `${store.name} isn't taking online orders here yet — reach out to the shop directly.`,
    }));
  }

  return routes;
}

function MeasurementInputs({ store }: { store: StoreSummary }) {
  const fields = [...store.measurement_fields].sort(
    (a, b) => a.sequence - b.sequence,
  );

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "8px",
        bgcolor: alpha(tokens.burgundy, 0.045),
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.1),
      }}
    >
      <Typography sx={{ fontWeight: 900, mb: 1 }}>
        Add at least one measurement
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {fields.map((field, index) => (
          <Box key={field.field_id}>
            <input
              type="hidden"
              name="measurement_field_id"
              value={field.field_id}
            />
            <TextField
              name={`measurement_${field.field_id}`}
              label={`${field.label} (${field.unit})`}
              required={index === 0}
              fullWidth
              slotProps={{
                htmlInput: { inputMode: "decimal" },
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function formatVisitSlot(slot: AvailabilitySlot): string {
  const start = new Date(slot.slot_start);
  const end = new Date(slot.slot_end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return slot.slot_start;
  }
  const day = new Intl.DateTimeFormat("en-GH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Africa/Accra",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-GH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Accra",
  });
  return `${day}, ${time.format(start)} - ${time.format(end)}`;
}

function formatVisitTime(slot: AvailabilitySlot): string {
  const start = new Date(slot.slot_start);
  const end = new Date(slot.slot_end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return slot.slot_start;
  }
  const time = new Intl.DateTimeFormat("en-GH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Accra",
  });
  return `${time.format(start)} - ${time.format(end)}`;
}

function visitDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Accra",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatVisitDay(date: Date): { label: string; caption: string } {
  return {
    label: new Intl.DateTimeFormat("en-GH", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "Africa/Accra",
    }).format(date),
    caption: new Intl.DateTimeFormat("en-GH", {
      weekday: "long",
      timeZone: "Africa/Accra",
    }).format(date),
  };
}

type VisitSlotGroup = {
  key: string;
  label: string;
  caption: string;
  slots: AvailabilitySlot[];
};

function groupVisitSlots(slots: AvailabilitySlot[]): VisitSlotGroup[] {
  const groups = new Map<string, VisitSlotGroup>();
  [...slots]
    .sort(
      (a, b) =>
        new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime(),
    )
    .forEach((slot) => {
      const start = new Date(slot.slot_start);
      if (Number.isNaN(start.getTime())) {
        return;
      }
      const key = visitDayKey(start);
      const existing = groups.get(key);
      if (existing) {
        existing.slots.push(slot);
        return;
      }
      const { label, caption } = formatVisitDay(start);
      groups.set(key, { key, label, caption, slots: [slot] });
    });
  return [...groups.values()];
}

const VISIT_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

// Splits an "Africa/Accra" day key ("YYYY-MM-DD") into civil-date parts.
// Month is 0-based to line up with Date's month indexing.
function visitDayKeyParts(key: string): {
  year: number;
  month: number;
  day: number;
} {
  const parts = key.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return { year, month: month - 1, day };
}

function makeVisitDayKey(year: number, month: number, day: number): string {
  return `${year}-${padDatePart(month + 1)}-${padDatePart(day)}`;
}

// A month index that flattens {year, month} into a single sortable number so
// prev/next paging is a simple increment.
function visitMonthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function visitMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GH", {
    month: "long",
    year: "numeric",
    timeZone: "Africa/Accra",
  }).format(new Date(Date.UTC(year, month, 1, 12)));
}

// Builds the Sun-Sat week rows for a month using plain Date math. Ghana runs at
// UTC+0 with no DST, so noon-UTC anchors line up with the Accra day keys the
// loader slots are bucketed by. Padding cells are null.
function buildVisitMonthWeeks(
  year: number,
  month: number,
): (string | null)[][] {
  const firstWeekday = new Date(Date.UTC(year, month, 1, 12)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let pad = 0; pad < firstWeekday; pad += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(makeVisitDayKey(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

function VisitSlotFields({ slots }: { slots: AvailabilitySlot[] }) {
  const groups = useMemo(() => groupVisitSlots(slots), [slots]);
  const groupsByKey = useMemo(() => {
    const map = new Map<string, VisitSlotGroup>();
    groups.forEach((group) => map.set(group.key, group));
    return map;
  }, [groups]);
  // A day is available iff it has at least one open slot in the loader data.
  const availableDayKeys = useMemo(
    () => new Set(groups.map((group) => group.key)),
    [groups],
  );
  const todayKey = useMemo(() => visitDayKey(new Date()), []);
  // The visible month spans from the earliest to the latest month that holds an
  // open slot; paging is clamped to that window.
  const monthBounds = useMemo(() => {
    if (groups.length === 0) {
      return null;
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    groups.forEach((group) => {
      const { year, month } = visitDayKeyParts(group.key);
      const index = visitMonthIndex(year, month);
      min = Math.min(min, index);
      max = Math.max(max, index);
    });
    return { min, max };
  }, [groups]);

  const [selectedDay, setSelectedDay] = useState(groups[0]?.key ?? "");
  const [viewMonthIndex, setViewMonthIndex] = useState(monthBounds?.min ?? 0);
  const currentGroup = groupsByKey.get(selectedDay) ?? groups[0];
  const [selectedSlot, setSelectedSlot] = useState(
    currentGroup?.slots[0]?.slot_start ?? "",
  );
  const activeSlot =
    currentGroup?.slots.find((slot) => slot.slot_start === selectedSlot) ??
    currentGroup?.slots[0];

  if (groups.length === 0 || !currentGroup || !activeSlot || !monthBounds) {
    return (
      <Alert severity="info">
        No home-visit slots are open right now. Try self-measure or come to the
        shop.
      </Alert>
    );
  }

  const viewYear = Math.floor(viewMonthIndex / 12);
  const viewMonth = viewMonthIndex % 12;
  const weeks = buildVisitMonthWeeks(viewYear, viewMonth);
  const canGoPrev = viewMonthIndex > monthBounds.min;
  const canGoNext = viewMonthIndex < monthBounds.max;

  return (
    <>
      <input type="hidden" name="slot_start" value={activeSlot.slot_start} />
      <Box
        sx={{
          p: 1.5,
          borderRadius: "8px",
          border: "1px solid",
          borderColor: alpha(tokens.burgundy, 0.12),
          bgcolor: alpha(tokens.burgundy, 0.045),
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 1,
          }}
        >
          <Typography sx={{ fontWeight: 900 }}>Choose visit day</Typography>
          <Stack
            direction="row"
            spacing={0.25}
            sx={{ alignItems: "center", flexShrink: 0 }}
          >
            <IconButton
              type="button"
              size="small"
              aria-label="Previous month"
              disabled={!canGoPrev}
              onClick={() =>
                setViewMonthIndex((index) =>
                  Math.max(monthBounds.min, index - 1),
                )
              }
              sx={{ color: tokens.burgundy }}
            >
              <ChevronLeftRounded fontSize="small" />
            </IconButton>
            <Typography
              sx={{
                fontWeight: 800,
                minWidth: 116,
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {visitMonthLabel(viewYear, viewMonth)}
            </Typography>
            <IconButton
              type="button"
              size="small"
              aria-label="Next month"
              disabled={!canGoNext}
              onClick={() =>
                setViewMonthIndex((index) =>
                  Math.min(monthBounds.max, index + 1),
                )
              }
              sx={{ color: tokens.burgundy }}
            >
              <ChevronRightRounded fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 280 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 0.5,
                mb: 0.5,
              }}
            >
              {VISIT_WEEKDAY_LABELS.map((label) => (
                <Typography
                  key={label}
                  variant="caption"
                  sx={{
                    textAlign: "center",
                    fontWeight: 800,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {label}
                </Typography>
              ))}
            </Box>
            {weeks.map((week, weekIndex) => (
              <Box
                key={weekIndex}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 0.5,
                  mb: 0.5,
                }}
              >
                {week.map((dayKey, dayIndex) => {
                  if (!dayKey) {
                    return <Box key={`pad-${weekIndex}-${dayIndex}`} />;
                  }
                  const { day } = visitDayKeyParts(dayKey);
                  const isAvailable = availableDayKeys.has(dayKey);
                  const isPast = dayKey < todayKey;
                  const isSelected = dayKey === currentGroup.key;
                  const isDisabled = isPast || !isAvailable;
                  const group = groupsByKey.get(dayKey);
                  const slotCount = group?.slots.length ?? 0;
                  return (
                    <Button
                      key={dayKey}
                      type="button"
                      disableElevation
                      disabled={isDisabled}
                      onClick={() => {
                        setSelectedDay(dayKey);
                        setSelectedSlot(group?.slots[0]?.slot_start ?? "");
                      }}
                      aria-label={`${visitMonthLabel(viewYear, viewMonth)} ${day}${
                        isAvailable
                          ? `, ${slotCount} slot${slotCount === 1 ? "" : "s"} open`
                          : ", unavailable"
                      }`}
                      aria-pressed={isSelected}
                      sx={{
                        minWidth: 0,
                        p: 0,
                        height: 44,
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "3px",
                        textTransform: "none",
                        border: "1px solid",
                        color: isSelected
                          ? tokens.white
                          : isAvailable
                            ? tokens.burgundy
                            : "text.disabled",
                        bgcolor: isSelected
                          ? tokens.burgundy
                          : isAvailable
                            ? alpha(tokens.burgundy, 0.08)
                            : "transparent",
                        borderColor: isSelected
                          ? tokens.burgundy
                          : isAvailable
                            ? alpha(tokens.burgundy, 0.28)
                            : "transparent",
                        "&:hover": {
                          bgcolor: isSelected
                            ? tokens.burgundy
                            : alpha(tokens.burgundy, 0.16),
                          borderColor: alpha(tokens.burgundy, 0.4),
                        },
                        "&.Mui-disabled": {
                          color: alpha(tokens.ink, 0.3),
                          bgcolor: alpha(tokens.ink, 0.03),
                          borderColor: "transparent",
                          textDecoration: isPast ? "line-through" : "none",
                        },
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          fontWeight: 800,
                          lineHeight: 1,
                          fontSize: "0.85rem",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {day}
                      </Typography>
                      <Box
                        sx={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          bgcolor:
                            isAvailable && !isSelected
                              ? tokens.burgundy
                              : isSelected
                                ? tokens.white
                                : "transparent",
                        }}
                      />
                    </Button>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>

        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mt: 1, flexWrap: "wrap", rowGap: 0.5 }}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "4px",
                border: "1px solid",
                borderColor: alpha(tokens.burgundy, 0.28),
                bgcolor: alpha(tokens.burgundy, 0.08),
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Available
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "4px",
                bgcolor: alpha(tokens.ink, 0.08),
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Unavailable / fully booked
            </Typography>
          </Stack>
        </Stack>

        <Typography sx={{ fontWeight: 900, mt: 1.5, mb: 1 }}>
          {currentGroup.caption} times
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 0.75,
          }}
        >
          {currentGroup.slots.map((slot) => {
            const selected = slot.slot_start === activeSlot.slot_start;
            return (
              <Button
                key={slot.slot_start}
                type="button"
                variant={selected ? "contained" : "outlined"}
                onClick={() => setSelectedSlot(slot.slot_start)}
                sx={{
                  justifyContent: "flex-start",
                  textTransform: "none",
                  fontWeight: 900,
                }}
              >
                {formatVisitTime(slot)}
              </Button>
            );
          })}
        </Box>
        <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
          Selected: {formatVisitSlot(activeSlot)}
        </Typography>
      </Box>
      <TextField
        name="address"
        label="Visit address"
        placeholder="House number, street, area, and nearby landmark"
        required
        fullWidth
        multiline
        minRows={2}
      />
    </>
  );
}

// Self-measure bespoke: fill the size chart, leave a note, then Add to Cart or
// Pay Now. Like the made-to-wear form, it carries no contact fields — personal
// details are collected at checkout.
function SelfMeasureForm({
  design,
  store,
  isSubmitting,
  rewardCodes,
  referralPreview,
  coverImage,
}: {
  design: Design;
  store: StoreSummary;
  isSubmitting: boolean;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  coverImage: string;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="store_handle" value={store.handle} />
      <input type="hidden" name="size_mode" value="self_measure" />
      <input type="hidden" name="title" value={design.title} />
      <input type="hidden" name="image" value={coverImage} />
      <input type="hidden" name="kind" value="bespoke" />
      <input
        type="hidden"
        name="deposit_minor"
        value={resolveDepositMinor(design, store)}
      />
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        <MeasurementInputs store={store} />
        <NoteField />
        <RewardFields codes={rewardCodes} referralPreview={referralPreview} />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: "stretch" }}
        >
          <Button
            type="submit"
            name="intent"
            value="add_to_cart"
            formNoValidate
            variant="outlined"
            size="large"
            startIcon={<ShoppingBagRounded />}
            disabled={isSubmitting}
            sx={{ flex: 1 }}
          >
            Add deposit to cart
          </Button>
          <Button
            type="submit"
            name="intent"
            value="buy_now"
            variant="contained"
            size="large"
            disabled={isSubmitting}
            sx={{
              flex: 1,
              "&.Mui-disabled": {
                bgcolor: tokens.burgundy,
                color: tokens.white,
                opacity: 0.72,
              },
            }}
          >
            {isSubmitting ? (
              <LoadingButtonLabel label="Opening checkout" />
            ) : (
              "Pay now"
            )}
          </Button>
        </Stack>
      </Stack>
    </Form>
  );
}

// Home-visit and come-to-shop keep their existing one-shot submit actions
// (booking / reservation). These API routes require the shopper's contact
// details up front and have no checkout step, so they still collect name and
// email here (payment method now defaults to mobile money server-side).
function CustomRouteForm({
  route,
  design,
  store,
  isSubmitting,
  rewardCodes,
  referralPreview,
  visitSlots,
  coverImage,
}: {
  route: CustomRoute;
  design: Design;
  store: StoreSummary;
  isSubmitting: boolean;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  visitSlots: AvailabilitySlot[];
  coverImage: string;
}) {
  if (!route.enabled) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        {route.disabledReason}
      </Alert>
    );
  }
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="custom" />
      <input type="hidden" name="store_handle" value={store.handle} />
      <input type="hidden" name="size_mode" value={route.mode} />
      <input type="hidden" name="title" value={design.title} />
      <input type="hidden" name="image" value={coverImage} />
      <input type="hidden" name="kind" value="bespoke" />
      <input
        type="hidden"
        name="deposit_minor"
        value={resolveDepositMinor(design, store)}
      />
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        {route.mode === "home_visit" ? (
          <VisitSlotFields slots={visitSlots} />
        ) : null}
        {route.mode === "come_to_shop" ? (
          <Alert severity="info">
            Reserve now, then visit {store.name} to have your measurements taken
            and settle payment in person.
          </Alert>
        ) : null}
        <NoteField />
        <ContactFields />
        {route.takesPayment ? (
          <RewardFields
            codes={rewardCodes}
            referralPreview={referralPreview}
            includePromo={route.mode !== "home_visit"}
          />
        ) : null}
        <Button
          type="submit"
          variant={route.takesPayment ? "contained" : "outlined"}
          size="large"
          disabled={isSubmitting}
          sx={{
            "&.Mui-disabled": route.takesPayment
              ? {
                  bgcolor: tokens.burgundy,
                  color: tokens.white,
                  opacity: 0.72,
                }
              : {
                  borderColor: alpha(tokens.burgundy, 0.42),
                  color: tokens.burgundy,
                  opacity: 0.72,
                },
          }}
        >
          {isSubmitting ? (
            <LoadingButtonLabel label="Submitting request" />
          ) : (
            route.buttonLabel
          )}
        </Button>
      </Stack>
    </Form>
  );
}

// The customise view: replaces the made-to-wear sizes/prices when the shopper
// taps "Customise". Shows the bespoke deposit (only here, to avoid a price clash
// with the listed prices), the three measurement routes, and reveals only the
// chosen route's form.
function BespokeCustomise({
  design,
  store,
  isSubmitting,
  error,
  rewardCodes,
  referralPreview,
  visitSlots,
  coverImage,
}: {
  design: Design;
  store?: StoreSummary;
  isSubmitting: boolean;
  error?: string | null;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  visitSlots: AvailabilitySlot[];
  coverImage: string;
}) {
  const [selectedMode, setSelectedMode] = useState<CustomSizeMode | null>(null);

  const unavailableMessage = !store?.handle
    ? "This design needs a store connection before it can take bespoke requests."
    : !design.customisation_allowed
      ? "This design is set up for listed-size orders only."
      : !store.settings.bespoke_enabled
        ? "This store has not enabled bespoke requests yet."
        : "";

  const depositLabel = store
    ? formatGHS(resolveDepositMinor(design, store))
    : "the deposit";
  const routes = store ? customRoutes(store, depositLabel, visitSlots) : [];
  const activeRoute =
    routes.find((route) => route.mode === selectedMode) ?? null;

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.16),
        borderRadius: "8px",
        bgcolor: "background.paper",
        boxShadow: `0 18px 48px ${alpha(tokens.ink, 0.08)}`,
      }}
    >
      <Stack direction="row" spacing={1.2} sx={{ alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            color: tokens.white,
            bgcolor: tokens.burgundy,
            flexShrink: 0,
          }}
        >
          <PointOfSaleRounded />
        </Box>
        <Box>
          <Typography variant="h6">Customise this piece</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Choose how you&apos;d like to be measured. The bespoke deposit is
            the same for every option.
          </Typography>
        </Box>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}

      {unavailableMessage || !store ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {unavailableMessage}
        </Alert>
      ) : (
        <>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              mt: 2,
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.5,
              borderRadius: "8px",
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.14),
              bgcolor: alpha(tokens.burgundy, 0.05),
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PointOfSaleRounded sx={{ color: tokens.burgundy }} />
              <Typography sx={{ fontWeight: 900 }}>Bespoke deposit</Typography>
            </Stack>
            <Typography sx={{ fontWeight: 950, color: "primary.main" }}>
              {depositLabel}
            </Typography>
          </Stack>

          <Typography sx={{ fontWeight: 900, mt: 2, mb: 1 }}>
            How would you like to be measured?
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
            }}
          >
            {routes.map((route) => {
              const selected = route.mode === selectedMode;
              return (
                <Button
                  key={route.mode}
                  type="button"
                  onClick={() => setSelectedMode(route.mode)}
                  variant={selected ? "contained" : "outlined"}
                  startIcon={route.icon}
                  aria-pressed={selected}
                  sx={{
                    justifyContent: "flex-start",
                    textTransform: "none",
                    fontWeight: 900,
                    px: 1.5,
                    py: 1.25,
                  }}
                >
                  {route.title}
                </Button>
              );
            })}
          </Box>

          {activeRoute ? (
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mb: 0.5 }}
              >
                {activeRoute.helper}
              </Typography>
              {activeRoute.mode === "self_measure" ? (
                <SelfMeasureForm
                  design={design}
                  store={store}
                  isSubmitting={isSubmitting}
                  rewardCodes={rewardCodes}
                  referralPreview={referralPreview}
                  coverImage={coverImage}
                />
              ) : (
                <CustomRouteForm
                  route={activeRoute}
                  design={design}
                  store={store}
                  isSubmitting={isSubmitting}
                  rewardCodes={rewardCodes}
                  referralPreview={referralPreview}
                  visitSlots={visitSlots}
                  coverImage={coverImage}
                />
              )}
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Select an option above to continue.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}

function RelatedDesigns({
  designs,
  store,
}: {
  designs: Design[];
  store?: StoreSummary;
}) {
  if (designs.length === 0) {
    return null;
  }

  const brand = store?.brand_color || tokens.burgundy;

  return (
    <Box
      sx={{
        mt: { xs: 4, md: 5 },
        pt: { xs: 3, md: 4 },
        borderTop: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 2.5,
          alignItems: { xs: "flex-start", sm: "flex-end" },
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: brand,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Keep browsing
          </Typography>
          <Typography variant="h5" component="h2">
            More from {store?.name ?? "this store"}
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
            Similar pieces from the same storefront, kept close so shoppers can
            compare before ordering.
          </Typography>
        </Box>
        {store?.handle ? (
          <Button
            component={RouterLink}
            to={`/store/${store.handle}`}
            variant="outlined"
            sx={{ flexShrink: 0 }}
          >
            View store
          </Button>
        ) : null}
      </Stack>
      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        {designs.map((design, index) => (
          <DesignCard key={design.design_id} design={design} index={index} />
        ))}
      </Box>
    </Box>
  );
}

function WaitlistPanel({
  store,
  design,
  isSubmitting,
  error,
  success,
}: {
  store?: StoreSummary;
  design: Design;
  isSubmitting: boolean;
  error: string | null | undefined;
  success: boolean | undefined;
}) {
  if (!store?.waitlist_enabled) {
    return null;
  }
  const brand = store.brand_color || tokens.burgundy;
  return (
    <Box
      sx={{
        mt: 2,
        p: { xs: 2.25, md: 2.75 },
        borderRadius: "8px",
        bgcolor: "rgba(var(--surface-rgb), 0.92)",
        border: "1px solid",
        borderColor: alpha(brand, 0.2),
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <GroupsRounded sx={{ color: brand }} />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Join the waiting list
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Sold out or made to order? Leave your details and {store.name} will
        reach out when {design.title} is ready to order.
      </Typography>
      {success ? (
        <Alert severity="success">
          You are on the list — {store.name} will be in touch.
        </Alert>
      ) : (
        <Form method="post">
          <input type="hidden" name="intent" value="waitlist" />
          <input type="hidden" name="store_handle" value={store.handle} />
          <Stack spacing={1.5}>
            <TextField
              name="customer_name"
              label="Your name"
              size="small"
              required
              fullWidth
            />
            <TextField
              name="customer_contact"
              label="Phone or email"
              size="small"
              required
              fullWidth
            />
            <TextField
              name="note"
              label="Note (optional)"
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder="Size, colour, timing…"
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? undefined : <GroupsRounded />}
              sx={{
                bgcolor: brand,
                "&:hover": { bgcolor: brand },
                "&.Mui-disabled": {
                  bgcolor: brand,
                  color: tokens.white,
                  opacity: 0.72,
                },
              }}
            >
              {isSubmitting ? (
                <LoadingButtonLabel label="Joining list" />
              ) : (
                "Notify me"
              )}
            </Button>
          </Stack>
        </Form>
      )}
    </Box>
  );
}

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
