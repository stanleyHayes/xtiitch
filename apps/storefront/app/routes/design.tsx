import {
  Form,
  Link as RouterLink,
  redirect,
  useNavigation,
} from "react-router";
import { useState, type ReactNode } from "react";
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
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
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
  type ReferralCode,
  type StoreSummary,
} from "../lib/api";
import { formatGHS, priceLabel } from "../lib/format";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import { addToCart } from "../lib/cart";
import TextField from "../components/form-text-field";
import { tokens } from "../theme";
import { DesignCard } from "../components/storefront";

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
    throw new Response("Design not found", { status: 404 });
  }
  const rewardCodes = await rewardCodesFromRequest(request);
  const [referralPreview, availability, storePage] = await Promise.all([
    rewardCodes.referralCode
      ? api.referral(rewardCodes.referralCode).catch(() => null)
      : Promise.resolve(null),
    design.store?.handle &&
    design.customisation_allowed &&
    design.store.settings.bespoke_enabled
      ? api.availability(design.store.handle).catch(() => null)
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

export function meta({ data }: Route.MetaArgs) {
  const title = data?.design.title ?? "Design";
  return [
    { title: `${title} · Xtiitch` },
    {
      name: "description",
      content: data?.design.description || `View ${title} on Xtiitch.`,
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

  if (intent === "add_to_cart") {
    const designHandle = params.handle ?? "";
    const title = String(form.get("title") ?? "").trim();
    const image = String(form.get("image") ?? "").trim();
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
    let sizeLabel = "Bespoke deposit";
    let amountMinor: number;
    if (kind === "bespoke") {
      amountMinor =
        Number.parseInt(String(form.get("deposit_minor") ?? "0"), 10) || 0;
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
    });
    return redirect("/cart", { headers: { "Set-Cookie": cookie } });
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
    const sizeMode = toCustomSizeMode(String(form.get("size_mode") ?? ""));
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

  const sizeBandId = String(form.get("size_band_id") ?? "").trim();
  if (!storeHandle || !sizeBandId || !customerName || !customerEmail) {
    return actionFailure(
      rewardCodes,
      "Add your name, email, and size before checkout.",
      null,
    );
  }

  const response = await api.placeOrder(storeHandle, {
    design_handle: params.handle,
    size_band_id: sizeBandId,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    method,
    ...rewardPayload(rewardCodes),
  });

  if (!response.ok) {
    return actionFailure(rewardCodes, checkoutMessage(response.error), null);
  }

  if (response.result.authorization_url) {
    return redirect(response.result.authorization_url);
  }
  return redirect(`/track/${response.result.order_id}`);
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

function checkoutMessage(code: string): string {
  switch (code) {
    case "store_not_verified":
      return "This store needs to finish payment verification before it can take online orders.";
    case "promotion_unavailable":
      return "That promo code is not available for this order. Check the code, remove it, or try a different reward.";
    case "invalid_order":
      return "Check the selected size and contact details, then try again.";
    case "not_found":
      return "This design is not available for ordering right now.";
    default:
      return "Checkout could not start. Please try again shortly.";
  }
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

function Gallery({ design }: { design: Design }) {
  const fallback = "/images/storefront-atelier-review.webp";
  const images = design.images.length > 0 ? design.images : [fallback];
  const [cover, setCover] = useState(images[0] ?? fallback);
  const hasUploadedCover = design.images.includes(cover);
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
      {design.images.length > 1 ? (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexWrap: "wrap" }}>
          {design.images.slice(0, 5).map((src, index) => {
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

function PaymentMethodField() {
  return (
    <TextField
      select
      name="method"
      label="Payment method"
      defaultValue="momo"
      required
      fullWidth
    >
      <MenuItem value="momo">Mobile money</MenuItem>
      <MenuItem value="card">Card</MenuItem>
    </TextField>
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
}: {
  design: Design;
  store?: StoreSummary;
  isSubmitting: boolean;
  error?: string | null;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
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
          <input type="hidden" name="image" value={design.images[0] ?? ""} />
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
            <ContactFields />
            <RewardFields
              codes={rewardCodes}
              referralPreview={referralPreview}
            />
            <PaymentMethodField />
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
                value="standard"
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
        "No home-visit slots are open for the next two weeks. Try self-measure or come to the shop.",
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

function VisitSlotFields({ slots }: { slots: AvailabilitySlot[] }) {
  return (
    <>
      <TextField
        select
        name="slot_start"
        label="Visit slot"
        defaultValue={slots[0]?.slot_start ?? ""}
        required
        fullWidth
      >
        {slots.slice(0, 12).map((slot) => (
          <MenuItem key={slot.slot_start} value={slot.slot_start}>
            {formatVisitSlot(slot)}
          </MenuItem>
        ))}
      </TextField>
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

function CustomRouteForm({
  route,
  store,
  isSubmitting,
  rewardCodes,
  referralPreview,
  visitSlots,
}: {
  route: CustomRoute;
  store: StoreSummary;
  isSubmitting: boolean;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  visitSlots: AvailabilitySlot[];
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: route.enabled
          ? alpha(tokens.ink, 0.09)
          : alpha(tokens.ink, 0.06),
        borderRadius: "8px",
        bgcolor: route.enabled
          ? "rgba(var(--surface-rgb), 0.86)"
          : alpha(tokens.ink, 0.025),
      }}
    >
      <Stack direction="row" spacing={1.1} sx={{ alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            color: route.enabled ? tokens.burgundy : "text.disabled",
            bgcolor: route.enabled
              ? alpha(tokens.burgundy, 0.08)
              : alpha(tokens.ink, 0.04),
            flexShrink: 0,
          }}
        >
          {route.icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography sx={{ fontWeight: 950 }}>{route.title}</Typography>
            <Chip
              size="small"
              label={route.takesPayment ? "Deposit" : "No online payment"}
              sx={{
                height: 24,
                bgcolor: route.takesPayment
                  ? alpha(tokens.burgundy, 0.08)
                  : alpha(tokens.success, 0.1),
                color: route.takesPayment ? tokens.burgundy : tokens.success,
                fontWeight: 900,
              }}
            />
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
            {route.helper}
          </Typography>
        </Box>
      </Stack>

      {!route.enabled ? (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {route.disabledReason}
        </Alert>
      ) : (
        <Form method="post">
          <input type="hidden" name="intent" value="custom" />
          <input type="hidden" name="store_handle" value={store.handle} />
          <input type="hidden" name="size_mode" value={route.mode} />
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {route.showMeasurements ? (
              <MeasurementInputs store={store} />
            ) : null}
            {route.mode === "home_visit" ? (
              <VisitSlotFields slots={visitSlots} />
            ) : null}
            <ContactFields />
            {route.takesPayment ? (
              <>
                <RewardFields
                  codes={rewardCodes}
                  referralPreview={referralPreview}
                  includePromo={route.mode !== "home_visit"}
                />
                <PaymentMethodField />
              </>
            ) : null}
            <Button
              type="submit"
              variant={route.takesPayment ? "contained" : "outlined"}
              size="large"
              disabled={isSubmitting}
              sx={{
                alignSelf: "stretch",
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
      )}
    </Box>
  );
}

function BespokeOrderPanel({
  design,
  store,
  isSubmitting,
  error,
  rewardCodes,
  referralPreview,
  visitSlots,
}: {
  design: Design;
  store?: StoreSummary;
  isSubmitting: boolean;
  error?: string | null;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  visitSlots: AvailabilitySlot[];
}) {
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

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        borderRadius: "8px",
        bgcolor: "rgba(var(--surface-rgb), 0.92)",
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
            color: tokens.burgundy,
            bgcolor: alpha(tokens.burgundy, 0.08),
            flexShrink: 0,
          }}
        >
          <PointOfSaleRounded />
        </Box>
        <Box>
          <Typography variant="h6">Request a bespoke fit</Typography>
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
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {routes.map((route) => (
            <CustomRouteForm
              key={route.mode}
              route={route}
              store={store}
              isSubmitting={isSubmitting}
              rewardCodes={rewardCodes}
              referralPreview={referralPreview}
              visitSlots={visitSlots}
            />
          ))}
        </Stack>
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
          <Gallery design={design} />

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
                {design.customisation_allowed
                  ? depositLabel
                  : priceLabel(design.prices)}
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

              {/* Only one price type is ever shown: the listed price for
                  made-to-wear pieces, or the deposit for customisation pieces —
                  never both. */}
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
                {design.customisation_allowed ? (
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

              {!design.customisation_allowed ? (
                <Box sx={{ mt: 2.5 }}>
                  <SizePriceList design={design} />
                </Box>
              ) : null}
            </Box>

            <Box
              sx={{
                mt: 2,
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", xl: "0.95fr 1.05fr" },
                alignItems: "start",
              }}
            >
              <StandardOrderPanel
                design={design}
                store={store}
                isSubmitting={isSubmitting}
                error={actionData?.standardError}
                rewardCodes={rewardCodes}
                referralPreview={referralPreview}
              />
              <BespokeOrderPanel
                design={design}
                store={store}
                isSubmitting={isSubmitting}
                error={actionData?.customError}
                rewardCodes={rewardCodes}
                referralPreview={referralPreview}
                visitSlots={visitSlots}
              />
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
