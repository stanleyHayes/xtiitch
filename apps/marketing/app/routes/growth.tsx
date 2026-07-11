import type { MetaDescriptor } from "react-router";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { pageMeta } from "../components/seo";
import { CtaBand, PageHero, Section, SectionHeading } from "../components/ui";
import { growthGuardrails, growthProgrammes, site } from "../content";
import { GrowthLoop } from "../features/growth/growth-loop";
import { ProgrammeCard } from "../features/growth/programme-card";

const accents = ["#800020", "#315f8f", "#2f6b4f", "#b87914"] as const;

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Growth programmes",
    description:
      "Promotion codes, referral rewards, affiliate links and sponsored placements for fashion businesses on Xtiitch, built around direct settlement and clear ledgers.",
    path: "/growth",
  });
}

export default function Growth() { // eslint-disable-line max-lines-per-function -- route action/loader with many conditional branches; refactor in follow-up
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
                  bgcolor: "rgba(var(--surface-rgb), 0.14)",
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
                    bgcolor: "rgba(var(--surface-rgb), 0.84)",
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
