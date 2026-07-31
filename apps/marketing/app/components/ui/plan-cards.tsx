import { useState } from "react";
import { useRouteLoaderData } from "react-router";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { alpha } from "@mui/material/styles";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { type Plan, site } from "../../content";
import { tokens } from "../../theme";
import { fadeInSx } from "./shared";
import { PlanCardHeader } from "./plan-card-header";

function splitPlanName(name: string): { title: string; subtitle: string } {
  const [title, ...rest] = name.split(" — ");
  return { title: title ?? name, subtitle: rest.join(" — ") };
}

type PricingCadence = "quarterly" | "yearly";

function planCycleCopy(
  plan: Plan,
  cadence: PricingCadence,
): { headline: string; period: string; detail: string; offer: string } {
  if (plan.code === "free") {
    return {
      headline: "GHS 0",
      period: "/month",
      detail: "No package charge. Start selling, then upgrade when ready.",
      offer: "Free plan",
    };
  }
  if (cadence === "quarterly") {
    return {
      headline: plan.quarterlyPrice ?? plan.monthlyPrice,
      period: "",
      detail: `First 3 months with 20% discount, then ${plan.quarterlyRenewalPrice ?? "the normal quarterly price"}.`,
      offer: "Quarterly first payment",
    };
  }
  return {
    headline: plan.yearlyPrice,
    period: "",
    detail: `First year includes 3 months free, then ${plan.yearlyRenewalPrice ?? "the normal yearly price"}.`,
    offer: plan.yearlySaving ?? "Yearly first payment",
  };
}

function PlanPricePanel({
  accent,
  cadence,
  plan,
}: {
  accent: string;
  cadence: PricingCadence;
  plan: Plan;
}) {
  const copy = planCycleCopy(plan, cadence);
  return (
    <Box
      sx={{
        py: 2,
        borderTop: "1px solid",
        borderBottom: "1px solid",
        borderColor: alpha(accent, 0.16),
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontWeight: 850 }}
      >
        {copy.offer}
      </Typography>
      <Stack
        direction="row"
        sx={{ mt: 0.35, alignItems: "baseline", gap: 0.75 }}
      >
        <Typography
          variant="h3"
          component="p"
          sx={{
            color: plan.highlight ? accent : "text.primary",
            fontSize: { xs: 32, md: 35 },
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {copy.headline}
        </Typography>
        {copy.period ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {copy.period}
          </Typography>
        ) : null}
      </Stack>
      <Typography
        variant="body2"
        sx={{ mt: 0.75, minHeight: 50, color: "text.secondary" }}
      >
        {copy.detail}
      </Typography>
      <Chip
        size="small"
        label={`${plan.salesFee} Xtiitch sales fee`}
        sx={{
          mt: 1.5,
          height: 24,
          bgcolor: alpha(accent, 0.08),
          color: accent,
          fontWeight: 900,
        }}
      />
    </Box>
  );
}

function PlanIncludedList({
  accent,
  includes,
}: {
  accent: string;
  includes: string[];
}) {
  const included = includes.slice(0, 4);
  const extraCount = Math.max(includes.length - included.length, 0);

  return (
    <Stack spacing={1.1} sx={{ flexGrow: 1 }}>
      <Typography
        variant="caption"
        sx={{ mb: 0.2, color: "text.secondary", fontWeight: 900 }}
      >
        Included
      </Typography>
      {included.map((line) => (
        <Box
          key={line}
          sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
        >
          <CheckCircleRoundedIcon
            fontSize="small"
            sx={{ color: accent, mt: "2px", fontSize: 18 }}
            aria-hidden
          />
          <Typography variant="body2">{line}</Typography>
        </Box>
      ))}
      {extraCount > 0 ? (
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 850, pl: 3.25 }}
        >
          + {extraCount} more plan benefits
        </Typography>
      ) : null}
    </Stack>
  );
}

function PlanButton({
  plan,
  signupUrl,
  title,
}: {
  plan: Plan;
  signupUrl: string;
  title: string;
}) {
  const label = plan.code === "free" ? "Start for free" : `Choose ${title}`;

  return (
    <Button
      component="a"
      href={signupUrl}
      variant={plan.highlight ? "contained" : "outlined"}
      size="large"
      disabled={!plan.available}
      endIcon={<ArrowForwardRoundedIcon />}
      sx={{
        mt: 2.5,
        borderRadius: 999,
        whiteSpace: "nowrap",
        ...(plan.highlight ? { bgcolor: tokens.burgundy } : null),
      }}
    >
      {plan.available ? label : "Coming later"}
    </Button>
  );
}

function PlanCard({
  cadence,
  plan,
  index,
  signupUrl,
}: {
  cadence: PricingCadence;
  plan: Plan;
  index: number;
  signupUrl: string;
}) {
  const { title, subtitle } = splitPlanName(plan.name);
  const accent = tokens.burgundy;

  return (
    <Card
      key={plan.name}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        borderRadius: 3,
        border: "1px solid",
        borderColor: plan.highlight
          ? alpha(tokens.burgundy, 0.5)
          : alpha(tokens.ink, 0.12),
        opacity: plan.available ? 1 : 0.88,
        bgcolor: plan.highlight
          ? alpha(tokens.burgundy, 0.045)
          : "rgba(var(--surface-rgb),0.94)",
        boxShadow: plan.highlight
          ? `0 30px 80px ${alpha(tokens.burgundy, 0.18)}`
          : `0 18px 54px ${alpha(tokens.ink, 0.07)}`,
        ...fadeInSx(80 + index * 80),
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,
          height: 4,
          pointerEvents: "none",
          background: plan.highlight
            ? tokens.burgundy
            : alpha(tokens.burgundy, 0.2),
        },
        "&:hover": {
          transform: "translateY(-5px)",
          boxShadow: plan.highlight
            ? `0 36px 88px ${alpha(tokens.burgundy, 0.24)}`
            : `0 28px 70px ${alpha(tokens.ink, 0.11)}`,
        },
      }}
    >
      <CardContent
        sx={{
          position: "relative",
          p: { xs: 2.5, md: 2.75 },
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Stack spacing={2.25}>
          <PlanCardHeader
            accent={accent}
            index={index}
            plan={plan}
            subtitle={subtitle}
            title={title}
          />
          <PlanPricePanel accent={accent} cadence={cadence} plan={plan} />
        </Stack>

        <Typography
          variant="body2"
          sx={{
            mt: 2,
            minHeight: { lg: 124 },
            color: "text.secondary",
            lineHeight: 1.65,
          }}
        >
          {plan.summary}
        </Typography>
        <Divider sx={{ my: 2 }} />
        <PlanIncludedList accent={accent} includes={plan.includes} />
        <PlanButton plan={plan} signupUrl={signupUrl} title={title} />
      </CardContent>
    </Card>
  );
}

export function PlanCards({ items }: { items: Plan[] }) {
  const [period, setPeriod] = useState<PricingCadence>("quarterly");
  // Picking a plan should start signup (self-serve register), not the waitlist.
  const rootData = useRouteLoaderData("root") as
    | { signupUrl?: string }
    | undefined;
  const signupUrl = rootData?.signupUrl ?? site.primaryCta.href;
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          mb: { xs: 3.5, md: 5 },
        }}
      >
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_event, next) => {
            if (next) setPeriod(next as PricingCadence);
          }}
          aria-label="Billing period"
          sx={{
            bgcolor: "background.paper",
            borderRadius: 999,
            p: 0.5,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 16px 40px -34px rgba(21,17,26,0.6)",
            "& .MuiToggleButton-root": {
              border: "none",
              borderRadius: 999,
              px: { xs: 2, md: 2.75 },
              py: 0.75,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 14,
              color: "text.secondary",
              transition: "background-color 200ms ease, color 200ms ease",
              "&.Mui-selected": {
                bgcolor: "primary.main",
                color: "common.white",
                "&:hover": { bgcolor: "primary.main" },
              },
            },
          }}
        >
          <ToggleButton value="quarterly">Quarterly · 20% off</ToggleButton>
          <ToggleButton value="yearly">Yearly · 3 months free</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 2.25 },
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          alignItems: "stretch",
        }}
      >
        {items.map((plan, index) => (
          <PlanCard
            key={plan.name}
            cadence={period}
            plan={plan}
            index={index}
            signupUrl={signupUrl}
          />
        ))}
      </Box>
    </Box>
  );
}
