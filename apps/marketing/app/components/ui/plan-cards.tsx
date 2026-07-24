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
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { type Plan, site } from "../../content";
import { tokens } from "../../theme";
import { fadeInSx } from "./shared";

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

function PlanCardHeader({
  accent,
  plan,
  subtitle,
  title,
}: {
  accent: string;
  plan: Plan;
  subtitle: string;
  title: string;
}) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 1.5,
      }}
    >
      <Box>
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            color: plan.highlight ? tokens.white : accent,
            bgcolor: plan.highlight ? accent : alpha(accent, 0.12),
            border: `1px solid ${alpha(accent, 0.22)}`,
            mb: 1.5,
          }}
        >
          <AutoAwesomeRoundedIcon />
        </Box>
        <Typography variant="h5" component="h3">
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mt: 0.4, color: "text.secondary", fontWeight: 750 }}
        >
          {subtitle}
        </Typography>
      </Box>
      {plan.badge ? (
        <Chip
          size="small"
          label={plan.badge}
          sx={{
            bgcolor: alpha(accent, plan.highlight ? 0.16 : 0.1),
            color: accent,
            fontWeight: 900,
          }}
        />
      ) : null}
    </Stack>
  );
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
        p: 2,
        borderRadius: 3,
        bgcolor: alpha(accent, plan.highlight ? 0.1 : 0.07),
        border: `1px solid ${alpha(accent, 0.14)}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: accent, fontWeight: 950, textTransform: "uppercase" }}
      >
        {copy.offer}
      </Typography>
      <Stack direction="row" sx={{ alignItems: "baseline", gap: 1 }}>
        <Typography
          variant="h3"
          component="p"
          sx={{ color: accent, letterSpacing: "-0.04em" }}
        >
          {copy.headline}
        </Typography>
        {copy.period ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {copy.period}
          </Typography>
        ) : null}
      </Stack>
      <Typography variant="body2" sx={{ mt: 0.75, color: "text.secondary" }}>
        {copy.detail}
      </Typography>
      <Chip
        size="small"
        label={`${plan.salesFee} Xtiitch sales fee`}
        sx={{
          mt: 1.25,
          bgcolor: alpha(accent, 0.12),
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
  const included = includes.slice(0, 5);
  const extraCount = Math.max(includes.length - included.length, 0);

  return (
    <Stack spacing={1.1} sx={{ flexGrow: 1 }}>
      {included.map((line) => (
        <Box
          key={line}
          sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
        >
          <CheckCircleRoundedIcon
            fontSize="small"
            sx={{ color: accent, mt: "2px" }}
            aria-hidden
          />
          <Typography variant="body2">{line}</Typography>
        </Box>
      ))}
      {extraCount > 0 ? (
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 850, pl: 3.6 }}
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
        mt: 3,
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
  const accent = plan.highlight ? tokens.burgundy : tokens.gold;

  return (
    <Card
      key={plan.name}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        borderRadius: 4,
        border: "1px solid",
        borderColor: plan.highlight
          ? alpha(tokens.burgundy, 0.42)
          : alpha(tokens.ink, 0.1),
        opacity: plan.available ? 1 : 0.88,
        bgcolor: "rgba(var(--surface-rgb),0.94)",
        boxShadow: plan.highlight
          ? `0 34px 90px ${alpha(tokens.burgundy, 0.22)}`
          : `0 24px 70px ${alpha(tokens.ink, 0.08)}`,
        ...fadeInSx(80 + index * 80),
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: plan.highlight
            ? `radial-gradient(circle at 20% 0%, ${alpha(tokens.burgundy, 0.2)}, transparent 38%)`
            : `radial-gradient(circle at 20% 0%, ${alpha(tokens.gold, 0.14)}, transparent 38%)`,
        },
        "&:hover": {
          transform: "translateY(-6px)",
          boxShadow: plan.highlight
            ? `0 42px 100px ${alpha(tokens.burgundy, 0.28)}`
            : `0 34px 82px ${alpha(tokens.ink, 0.14)}`,
        },
      }}
    >
      <CardContent
        sx={{
          position: "relative",
          p: { xs: 2.5, md: 3 },
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Stack spacing={2}>
          <PlanCardHeader
            accent={accent}
            plan={plan}
            subtitle={subtitle}
            title={title}
          />
          <PlanPricePanel accent={accent} cadence={cadence} plan={plan} />
        </Stack>

        <Typography
          variant="body2"
          sx={{ mt: 2.25, color: "text.secondary", lineHeight: 1.7 }}
        >
          {plan.summary}
        </Typography>
        <Divider sx={{ my: 2.25 }} />
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
        sx={{ display: "flex", justifyContent: "center", mb: { xs: 3.5, md: 5 } }}
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
          gap: 3,
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
