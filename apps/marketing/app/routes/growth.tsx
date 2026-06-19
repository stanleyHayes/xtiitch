import type { MetaDescriptor } from "react-router";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import { pageMeta } from "../components/seo";
import { CtaBand, PageHero, Section, SectionHeading } from "../components/ui";
import {
  growthGuardrails,
  growthProgrammes,
  site,
  type GrowthProgramme,
} from "../content";

const programmeIcons: SvgIconComponent[] = [
  LocalOfferRoundedIcon,
  HandshakeRoundedIcon,
  TrendingUpRoundedIcon,
  CampaignRoundedIcon,
];

const accents = ["#800020", "#315f8f", "#2f6b4f", "#b87914"] as const;

const growthLoop = [
  {
    title: "Create the offer",
    body: "Set promo rules, approve a referral programme, register an affiliate, or schedule a sponsored slot.",
    Icon: LocalOfferRoundedIcon,
  },
  {
    title: "Share the link",
    body: "Customers or partners land on a storefront, design page, or labelled sponsored placement.",
    Icon: StorefrontRoundedIcon,
  },
  {
    title: "Let checkout decide",
    body: "Checkout validates the code or attribution, calculates the real payable amount, and records the pending ledger item.",
    Icon: ReceiptLongRoundedIcon,
  },
  {
    title: "Finalize after payment",
    body: "Rewards, redemptions, and partner commissions become real only after the provider confirms payment.",
    Icon: PaidRoundedIcon,
  },
];

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Growth programmes",
    description:
      "Promotion codes, referral rewards, affiliate links and sponsored placements for fashion businesses on Xtiitch, built around direct settlement and clear ledgers.",
    path: "/growth",
  });
}

function ProgrammeCard({
  programme,
  index,
}: {
  programme: GrowthProgramme;
  index: number;
}) {
  const Icon = programmeIcons[index] ?? TrendingUpRoundedIcon;
  const accent = accents[index % accents.length];

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: 360,
        p: { xs: 2.5, md: 3 },
        border: "1px solid",
        borderColor: index === 0 ? `${accent}55` : "divider",
        borderRadius: 1,
        bgcolor: "rgba(255,255,255,0.9)",
        overflow: "hidden",
        boxShadow:
          index === 0
            ? "0 30px 78px -56px rgba(128,0,32,0.72)"
            : "0 22px 58px -52px rgba(21,17,26,0.44)",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: `${accent}66`,
          boxShadow: "0 30px 76px -52px rgba(21,17,26,0.6)",
        },
        "&:before": {
          content: '""',
          position: "absolute",
          inset: "0 0 auto 0",
          height: 5,
          bgcolor: accent,
        },
      }}
    >
      <Icon
        aria-hidden
        sx={{
          position: "absolute",
          right: -20,
          bottom: -22,
          fontSize: 128,
          color: `${accent}14`,
          transform: "rotate(-7deg)",
        }}
      />
      <Box sx={{ position: "relative" }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Box
            aria-hidden
            sx={{
              width: 46,
              height: 46,
              borderRadius: 1,
              display: "grid",
              placeItems: "center",
              bgcolor: `${accent}12`,
              color: accent,
              border: "1px solid",
              borderColor: `${accent}28`,
            }}
          >
            <Icon fontSize="small" />
          </Box>
          <Chip
            label={programme.label}
            size="small"
            variant="outlined"
            sx={{ borderColor: `${accent}40`, color: accent }}
          />
        </Stack>
        <Typography variant="h4" component="h2" sx={{ mt: 2.5 }}>
          {programme.title}
        </Typography>
        <Typography sx={{ mt: 1.25, color: "text.secondary" }}>
          {programme.body}
        </Typography>
        <Chip
          label={programme.status}
          size="small"
          sx={{
            mt: 2,
            maxWidth: "100%",
            bgcolor: `${accent}10`,
            color: accent,
            "& .MuiChip-label": {
              whiteSpace: "normal",
              py: 0.4,
            },
          }}
        />
        <Stack spacing={1.1} sx={{ mt: 2.25 }}>
          {programme.proof.map((item) => (
            <Box
              key={item}
              sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 1,
                alignItems: "flex-start",
              }}
            >
              <CheckCircleRoundedIcon
                aria-hidden
                fontSize="small"
                sx={{ mt: "2px", color: accent }}
              />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {item}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

function GrowthLoop() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        gap: { xs: 2, md: 0 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "rgba(255,255,255,0.84)",
        boxShadow: "0 26px 70px -56px rgba(21,17,26,0.56)",
      }}
    >
      {growthLoop.map((step, index) => {
        const accent = accents[index % accents.length];
        return (
          <Box
            key={step.title}
            sx={{
              position: "relative",
              p: { xs: 2.5, md: 3 },
              minHeight: 250,
              borderRight: {
                xs: "none",
                md: index === growthLoop.length - 1 ? "none" : "1px solid",
              },
              borderBottom: {
                xs: index === growthLoop.length - 1 ? "none" : "1px solid",
                md: "none",
              },
              borderColor: "divider",
              overflow: "hidden",
            }}
          >
            <Typography
              aria-hidden
              component="p"
              sx={{
                position: "absolute",
                right: 16,
                top: 10,
                fontFamily: "inherit",
                fontSize: 72,
                lineHeight: 1,
                color: `${accent}12`,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </Typography>
            <Box
              aria-hidden
              sx={{
                width: 44,
                height: 44,
                mb: 2,
                borderRadius: 1,
                display: "grid",
                placeItems: "center",
                bgcolor: `${accent}12`,
                color: accent,
                border: "1px solid",
                borderColor: `${accent}28`,
              }}
            >
              <step.Icon fontSize="small" />
            </Box>
            <Typography variant="h5" component="h3">
              {step.title}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
              {step.body}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export default function Growth() {
  return (
    <>
      <PageHero
        eyebrow="Growth"
        title="Promotion, affiliate and sponsored growth without messy money"
        subtitle="Xtiitch gives fashion businesses ways to sell more while keeping every discount, reward, placement and commission tied to a real order or a clear operator ledger."
      />

      <Section>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, md: 5 },
            gridTemplateColumns: { xs: "1fr", lg: "0.9fr 1.1fr" },
            alignItems: "center",
          }}
        >
          <Box>
            <SectionHeading
              align="left"
              eyebrow="Growth layer"
              title="Four programmes, one clean operating model"
              subtitle="Promos help stores sell, referrals turn happy customers into advocates, affiliates track partner performance, and sponsored placements bring verified businesses onto the public marketing surface."
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <Button
                component={RouterLink}
                to={site.primaryCta.href}
                variant="contained"
                endIcon={<ArrowForwardRoundedIcon />}
              >
                Join the waitlist
              </Button>
              <Button component={RouterLink} to="/pricing" variant="outlined">
                See pricing
              </Button>
            </Stack>
          </Box>
          <Box
            sx={{
              position: "relative",
              minHeight: { xs: 300, md: 430 },
              borderRadius: 1,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 32px 86px -56px rgba(21,17,26,0.7)",
            }}
          >
            <Box
              component="img"
              src="/images/payment-handoff.webp"
              alt="Fashion business packaging a garment while a customer confirms the order"
              loading="lazy"
              decoding="async"
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(21,17,26,0.08), rgba(21,17,26,0.78))",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                p: { xs: 2.5, md: 3.5 },
                color: "common.white",
              }}
            >
              <Chip
                label="Built around direct settlement"
                sx={{
                  mb: 1.5,
                  bgcolor: "rgba(255,255,255,0.14)",
                  color: "common.white",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              />
              <Typography variant="h3" component="p">
                Growth should not create a wallet problem.
              </Typography>
              <Typography sx={{ mt: 1, color: "rgba(255,255,255,0.78)" }}>
                The platform tracks value, but customer money still settles
                through Paystack to the right account.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Section>

      <Section alt>
        <SectionHeading
          eyebrow="Programmes"
          title="What businesses and operators can run"
          subtitle="The marketing promise now matches the built growth surfaces: business promo codes, referral rewards, affiliate tracking and sponsored placements."
        />
        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          }}
        >
          {growthProgrammes.map((programme, index) => (
            <ProgrammeCard
              key={programme.title}
              programme={programme}
              index={index}
            />
          ))}
        </Box>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Attribution flow"
          title="Every reward follows the order trail"
          subtitle="Codes and partner links can help customers arrive, but value becomes real only when the order and payment trail prove it."
        />
        <GrowthLoop />
      </Section>

      <Section alt>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, md: 4 },
            gridTemplateColumns: { xs: "1fr", md: "0.85fr 1.15fr" },
            alignItems: "start",
          }}
        >
          <Box>
            <SectionHeading
              align="left"
              eyebrow="Trust rules"
              title="Growth with guardrails"
              subtitle="The same rules that make Xtiitch trustworthy for payments also shape promotions, referrals, affiliates and sponsored posts."
            />
          </Box>
          <Box sx={{ display: "grid", gap: 1.5 }}>
            {growthGuardrails.map((rule, index) => {
              const Icon =
                index === 0
                  ? ShieldRoundedIcon
                  : index === 2
                    ? VerifiedUserRoundedIcon
                    : CheckCircleRoundedIcon;
              return (
                <Box
                  key={rule}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 1.5,
                    alignItems: "flex-start",
                    p: 2,
                    border: "1px solid",
                    borderColor:
                      index === 0 ? "rgba(128,0,32,0.28)" : "divider",
                    borderRadius: 1,
                    bgcolor: "rgba(255,255,255,0.84)",
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: `${accents[index % accents.length]}12`,
                      color: accents[index % accents.length],
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Typography sx={{ color: "text.secondary" }}>
                    {rule}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Section>

      <CtaBand
        title="Ready to grow with a cleaner system?"
        body="Join the waitlist and tell us whether you need promo codes, partner tracking, sponsored placement, or all three."
      />
    </>
  );
}
