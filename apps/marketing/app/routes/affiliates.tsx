/* eslint-disable max-lines -- long-form marketing page: mostly copy blocks */
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLoaderData, type MetaDescriptor } from "react-router";
import { pageMeta } from "../components/seo";
import { Eyebrow } from "../components/ui";
import { perspectiveGridSx, riseInSx } from "../components/ui/shared";
import { requireMarketingFlag } from "../lib/launch-gate";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Become a Xtiitch affiliate",
    description:
      "Create a trackable Xtiitch affiliate code and earn approved commission from qualifying purchases and paid-plan signups.",
    path: "/affiliates",
  });
}

export async function loader() {
  await requireMarketingFlag("affiliate_signup");
  const base =
    (typeof process !== "undefined"
      ? process.env.XTIITCH_AFFILIATE_URL
      : undefined) ??
    (process.env.NODE_ENV === "production"
      ? "https://affiliate.xtiitch.com"
      : "http://localhost:3404");
  const portalUrl = base.replace(/\/+$/, "");
  return {
    signupUrl: `${portalUrl}/signup`,
    loginUrl: `${portalUrl}/login`,
  };
}

const steps = [
  {
    number: "01",
    title: "Create your account",
    body: "Tell us about your audience, choose your referral code, and join immediately.",
  },
  {
    number: "02",
    title: "Activate",
    body: "Use the secure email link to set your password and open your affiliate portal.",
  },
  {
    number: "03",
    title: "Share and track",
    body: "Use your main link or named campaign links, then follow clicks, conversions, and commission.",
  },
] as const;

const ledgerRows = [
  { label: "Instagram bio", status: "Approved", value: "GHS 84.00" },
  { label: "WhatsApp status", status: "Pending", value: "GHS 36.00" },
  { label: "YouTube review", status: "Tracked", value: "GHS 52.00" },
] as const;

const portalBenefits = [
  {
    Icon: QueryStatsRoundedIcon,
    label: "See clicks and conversions by campaign",
  },
  {
    Icon: VerifiedUserRoundedIcon,
    label: "Follow pending, approved, and reversed commission",
  },
  {
    Icon: PaymentsRoundedIcon,
    label: "Choose mobile money or bank payout details",
  },
] as const;

export default function Affiliates() {
  const { signupUrl, loginUrl } = useLoaderData<typeof loader>();

  return (
    <>
      <AffiliateHero signupUrl={signupUrl} loginUrl={loginUrl} />
      <HowItWorks />
      <AffiliateWorkspace />
      <FinalCallToAction signupUrl={signupUrl} loginUrl={loginUrl} />
    </>
  );
}

function AffiliateHero({
  signupUrl,
  loginUrl,
}: {
  signupUrl: string;
  loginUrl: string;
}) {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        color: "#fff8fa",
        bgcolor: "primary.main",
        overflow: "hidden",
        "&::before": perspectiveGridSx({ lightOnDark: true, opacity: 1 }),
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          width: { xs: 310, md: 560 },
          height: { xs: 310, md: 560 },
          top: { xs: -180, md: -310 },
          right: { xs: -190, md: -170 },
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: "50%",
          boxShadow:
            "0 0 0 70px rgba(255,255,255,.025), 0 0 0 150px rgba(255,255,255,.018)",
        }}
      />
      <Container
        sx={{ position: "relative", zIndex: 1, py: { xs: 7, md: 12 } }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.08fr .92fr" },
            gap: { xs: 6, lg: 9 },
            alignItems: "center",
          }}
        >
          <Box sx={riseInSx(40)}>
            <Typography
              component="p"
              sx={{
                mb: 2,
                fontSize: 12,
                fontWeight: 850,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                opacity: 0.72,
              }}
            >
              Xtiitch affiliate programme
            </Typography>
            <Typography
              component="h1"
              variant="h1"
              sx={{
                maxWidth: 760,
                fontSize: { xs: 43, sm: 59, md: 76 },
                lineHeight: 0.97,
                textWrap: "balance",
              }}
            >
              Turn trusted recommendations into tracked earnings.
            </Typography>
            <Typography
              sx={{
                mt: 3,
                maxWidth: 610,
                fontSize: { xs: 17, md: 20 },
                lineHeight: 1.65,
                opacity: 0.78,
              }}
            >
              Share Xtiitch with creators, fashion businesses, and communities.
              We track qualified activity and show every commission in your own
              portal.
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ mt: 4, alignItems: { sm: "center" } }}
            >
              <Button
                href={signupUrl}
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{
                  color: "primary.main",
                  bgcolor: "#fff8fa",
                  "&:hover": { bgcolor: "#ffffff" },
                }}
              >
                Join now
              </Button>
              <Button
                href={loginUrl}
                variant="text"
                size="large"
                sx={{ color: "#fff8fa", opacity: 0.84 }}
              >
                Already an affiliate? Sign in
              </Button>
            </Stack>
          </Box>

          <ReferralPreview />
        </Box>
      </Container>
    </Box>
  );
}

function ReferralPreview() {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: { xs: 390, md: 480 },
        ...riseInSx(180),
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: { xs: "0 0 38px 0", sm: "0 8% 38px 3%" },
          p: { xs: 2.5, sm: 3.5 },
          // This preview intentionally stays light in both themes, so every
          // colour inside it is local to the surface. Theme text tokens turn
          // pale in dark mode and would disappear against this paper card.
          color: "#251b20",
          bgcolor: "#fffafc",
          borderRadius: "28px 8px 28px 8px",
          boxShadow: "0 34px 80px -32px rgba(30,0,12,.64)",
          transform: { sm: "rotate(2deg)" },
        }}
      >
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Box>
            <Typography
              sx={{ color: "#6e6368", fontSize: 12, fontWeight: 800 }}
            >
              PORTAL PREVIEW · YOUR REFERRAL CODE
            </Typography>
            <Typography
              sx={{
                mt: 0.4,
                color: "#800020",
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              AMA20
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              width: 48,
              height: 48,
              placeItems: "center",
              color: "#800020",
              bgcolor: "rgba(128,0,32,.08)",
              borderRadius: 1.5,
            }}
          >
            <LinkRoundedIcon />
          </Box>
        </Stack>

        <Box
          sx={{
            mt: 3,
            p: 2,
            bgcolor: "rgba(128,0,32,.045)",
            borderRadius: 1.5,
          }}
        >
          <Typography sx={{ color: "#6e6368", fontSize: 12 }}>
            Share link
          </Typography>
          <Typography
            sx={{
              mt: 0.5,
              fontSize: 14,
              fontWeight: 750,
              overflowWrap: "anywhere",
            }}
          >
            xtiitch.com/r/AMA20
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 3,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1.5,
          }}
        >
          <Box>
            <Typography sx={{ color: "#6e6368", fontSize: 12 }}>
              Tracked visits
            </Typography>
            <Typography
              sx={{
                mt: 0.2,
                fontSize: 32,
                fontWeight: 850,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              248
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ color: "#6e6368", fontSize: 12 }}>
              Commission
            </Typography>
            <Typography
              sx={{
                mt: 0.2,
                color: "#800020",
                fontSize: 32,
                fontWeight: 850,
              }}
            >
              GHS 172
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          position: "absolute",
          right: { xs: 12, sm: 0 },
          bottom: 0,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1.25,
          color: "#174c31",
          bgcolor: "#e6f5ec",
          border: "1px solid rgba(35,122,75,.2)",
          borderRadius: 999,
          boxShadow: "0 18px 34px -22px rgba(15,61,37,.7)",
        }}
      >
        <CheckRoundedIcon sx={{ fontSize: 19 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 850 }}>
          Conversion approved
        </Typography>
      </Box>
    </Box>
  );
}

function HowItWorks() {
  return (
    <Box
      component="section"
      sx={{ py: { xs: 7, md: 11 }, bgcolor: "background.default" }}
    >
      <Container>
        <Box sx={{ maxWidth: 720, mb: { xs: 4, md: 6 }, ...riseInSx(40) }}>
          <Eyebrow>How it works</Eyebrow>
          <Typography
            variant="h2"
            component="h2"
            sx={{ fontSize: { xs: 35, md: 51 } }}
          >
            One account. One link. A clear record of what you earned.
          </Typography>
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            borderTop: "1px solid",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          {steps.map((step, index) => (
            <Box
              key={step.number}
              sx={{
                py: { xs: 3, md: 4.5 },
                px: { xs: 0, md: index === 0 ? "0" : 4 },
                pr: { md: index === steps.length - 1 ? 0 : 4 },
                borderTop: { xs: index === 0 ? 0 : "1px solid", md: 0 },
                borderLeft: { xs: 0, md: index === 0 ? 0 : "1px solid" },
                borderColor: "divider",
                ...riseInSx(120 + index * 80),
              }}
            >
              <Typography
                sx={{ color: "primary.main", fontSize: 12, fontWeight: 900 }}
              >
                {step.number}
              </Typography>
              <Typography
                variant="h4"
                component="h3"
                sx={{ mt: 3, fontSize: 25 }}
              >
                {step.title}
              </Typography>
              <Typography
                sx={{ mt: 1.25, color: "text.secondary", maxWidth: 340 }}
              >
                {step.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

// eslint-disable-next-line max-lines-per-function -- long-form marketing section: mostly copy, no branching
function AffiliateWorkspace() {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        py: { xs: 7, md: 11 },
        bgcolor: "background.paper",
        borderTop: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        "&::before": perspectiveGridSx({ opacity: 0.7 }),
      }}
    >
      <Container sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: ".78fr 1.22fr" },
            gap: { xs: 5, lg: 8 },
            alignItems: "center",
          }}
        >
          <Box sx={riseInSx(40)}>
            <Eyebrow>Your portal</Eyebrow>
            <Typography
              variant="h2"
              component="h2"
              sx={{ fontSize: { xs: 35, md: 50 } }}
            >
              You never have to guess what happened after the click.
            </Typography>
            <Typography
              sx={{
                mt: 2.5,
                color: "text.secondary",
                fontSize: 17,
                maxWidth: 500,
              }}
            >
              Build named campaign links, see conversion status, and keep payout
              details current from one dedicated workspace.
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 3.5 }}>
              {portalBenefits.map(({ Icon, label }) => (
                <Stack
                  key={label}
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Box sx={{ color: "primary.main", display: "grid" }}>
                    <Icon />
                  </Box>
                  <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              p: { xs: 2, sm: 3 },
              bgcolor: "#24181f",
              border: "1px solid rgba(255,248,250,.1)",
              borderRadius: "8px 28px 8px 28px",
              boxShadow: "0 34px 80px -54px rgba(33,23,28,.9)",
              ...riseInSx(180),
            }}
          >
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2.5,
              }}
            >
              <Box>
                <Typography
                  sx={{
                    color: "rgba(255,248,250,.68)",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  CAMPAIGN LEDGER
                </Typography>
                <Typography
                  sx={{
                    color: "#fff8fa",
                    mt: 0.4,
                    fontSize: 20,
                    fontWeight: 850,
                  }}
                >
                  Recent conversions
                </Typography>
              </Box>
              <QueryStatsRoundedIcon sx={{ color: "#d98aa4" }} />
            </Stack>
            {ledgerRows.map((row, index) => (
              <Box
                key={row.label}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 2,
                  py: 2,
                  borderTop: index === 0 ? "1px solid rgba(255,255,255,.1)" : 0,
                  borderBottom: "1px solid rgba(255,255,255,.1)",
                }}
              >
                <Box>
                  <Typography sx={{ color: "#fff8fa", fontWeight: 750 }}>
                    {row.label}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 0.35,
                      display: "inline-flex",
                      width: "fit-content",
                      px: 0.8,
                      py: 0.3,
                      borderRadius: 999,
                      color:
                        row.status === "Approved"
                          ? "#8ce0ad"
                          : row.status === "Pending"
                            ? "#f0c873"
                            : "#e3a6ba",
                      bgcolor:
                        row.status === "Approved"
                          ? "rgba(86,191,127,.12)"
                          : row.status === "Pending"
                            ? "rgba(214,160,56,.12)"
                            : "rgba(217,138,164,.12)",
                      fontSize: 12,
                    }}
                  >
                    {row.status}
                  </Typography>
                </Box>
                <Typography sx={{ color: "#fff8fa", fontWeight: 850 }}>
                  {row.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function FinalCallToAction({
  signupUrl,
  loginUrl,
}: {
  signupUrl: string;
  loginUrl: string;
}) {
  return (
    <Box
      component="section"
      sx={{ py: { xs: 7, md: 11 }, bgcolor: "background.default" }}
    >
      <Container>
        <Box
          sx={{
            position: "relative",
            p: { xs: 3.5, sm: 6, md: 8 },
            bgcolor: "primary.main",
            color: "#fff8fa",
            borderRadius: "28px 8px 28px 8px",
            overflow: "hidden",
            ...riseInSx(40),
          }}
        >
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 850,
              letterSpacing: ".12em",
              opacity: 0.68,
            }}
          >
            SIGNUPS OPEN
          </Typography>
          <Typography
            variant="h2"
            component="h2"
            sx={{
              mt: 2,
              maxWidth: 760,
              fontSize: { xs: 35, md: 55 },
              textWrap: "balance",
            }}
          >
            Know people who should be building on Xtiitch?
          </Typography>
          <Typography
            sx={{
              mt: 2,
              maxWidth: 600,
              fontSize: 17,
              lineHeight: 1.65,
              opacity: 0.76,
            }}
          >
            Choose your code, activate your account, and start sharing
            immediately.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ mt: 4 }}
          >
            <Button
              href={signupUrl}
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                color: "primary.main",
                bgcolor: "#fff8fa",
                "&:hover": { bgcolor: "#fff" },
              }}
            >
              Create your account
            </Button>
            <Button
              href={loginUrl}
              variant="text"
              size="large"
              sx={{ color: "#fff8fa" }}
            >
              Affiliate sign in
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
