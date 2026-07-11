import { useState } from "react";
import { Link as RouterLink, useRouteLoaderData } from "react-router";
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
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { type Plan, site } from "../../content";
import { useMarketingFlags } from "../../root";
import { fadeInSx } from "./shared";

export function PlanCards({ items }: { items: Plan[] }) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const yearly = period === "yearly";
  // Picking a plan should start signup (self-serve register), not the waitlist.
  const rootData = useRouteLoaderData("root") as
    | { signupUrl?: string }
    | undefined;
  const signupUrl = rootData?.signupUrl ?? site.primaryCta.href;
  // Pre-launch (pricing flag off) the per-plan signup CTAs are hidden and
  // replaced by a single prominent "Join the waitlist" button below the grid.
  const { pricing: pricingLive } = useMarketingFlags();
  return (
    <Box>
      <Box
        sx={{ display: "flex", justifyContent: "center", mb: { xs: 3.5, md: 5 } }}
      >
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_event, next) => {
            if (next) setPeriod(next as "monthly" | "yearly");
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
          <ToggleButton value="monthly">Monthly</ToggleButton>
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
        <Card
          key={plan.name}
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            borderColor: plan.highlight ? "primary.main" : "divider",
            borderWidth: plan.highlight ? 2 : 1,
            opacity: plan.available ? 1 : 0.92,
            bgcolor: plan.highlight
              ? "rgba(var(--surface-rgb),0.98)"
              : "background.paper",
            transform: plan.highlight ? { md: "translateY(-10px)" } : "none",
            boxShadow: plan.highlight
              ? "0 34px 86px -52px rgba(128,0,32,0.76)"
              : undefined,
            ...fadeInSx(80 + index * 80),
            "&:hover": {
              transform: plan.highlight
                ? { xs: "translateY(-4px)", md: "translateY(-14px)" }
                : "translateY(-4px)",
              boxShadow: plan.highlight
                ? "0 38px 92px -50px rgba(128,0,32,0.82)"
                : "0 30px 70px -50px rgba(21,17,26,0.55)",
            },
          }}
        >
          <Box
            aria-hidden
            sx={{
              height: 8,
              bgcolor: plan.highlight ? "primary.main" : "rgba(128,0,32,0.12)",
            }}
          />
          <CardContent
            sx={{
              p: { xs: 3, md: 3.25 },
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="h5" component="h3">
                {plan.name}
              </Typography>
              {plan.badge ? (
                <Chip
                  size="small"
                  label={plan.badge}
                  color={plan.highlight ? "primary" : "default"}
                  variant={plan.highlight ? "filled" : "outlined"}
                />
              ) : null}
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "baseline",
                gap: 1,
                mt: 1.5,
              }}
            >
              <Typography
                variant="h3"
                component="p"
                sx={{ color: "primary.main" }}
              >
                {yearly ? plan.yearlyPrice : plan.monthlyPrice}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {yearly ? "per year" : "per month"}
              </Typography>
            </Box>
            {yearly && plan.yearlySaving ? (
              <Chip
                size="small"
                label={plan.yearlySaving}
                color="success"
                variant="outlined"
                sx={{ alignSelf: "flex-start", mt: 1, fontWeight: 800 }}
              />
            ) : null}
            {!yearly && plan.quarterlyPrice ? (
              <Typography
                variant="body2"
                sx={{ mt: 0.75, color: "text.secondary" }}
              >
                or {plan.quarterlyPrice} · save 20%
              </Typography>
            ) : null}
            <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
              {plan.summary}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1.25} sx={{ flexGrow: 1 }}>
              {plan.includes.map((line) => (
                <Box
                  key={line}
                  sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                >
                  <CheckCircleRoundedIcon
                    fontSize="small"
                    sx={{ color: "success.main", mt: "2px" }}
                    aria-hidden
                  />
                  <Typography variant="body2">{line}</Typography>
                </Box>
              ))}
            </Stack>
            {pricingLive ? (
              <Button
                component="a"
                href={signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant={plan.highlight ? "contained" : "outlined"}
                size="large"
                disabled={!plan.available}
                sx={{ mt: 3 }}
              >
                {plan.available ? "Get started" : "Coming later"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
        ))}
      </Box>
      {/* Pre-launch: one prominent waitlist CTA stands in for the per-plan
          signup buttons, scrolling/linking to the waitlist form. */}
      {pricingLive ? null : (
        <Box sx={{ mt: { xs: 4, md: 5 }, display: "flex", justifyContent: "center" }}>
          <Button
            component={RouterLink}
            to={site.primaryCta.href}
            variant="contained"
            size="large"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ minWidth: { xs: "100%", sm: 280 } }}
          >
            {site.primaryCta.label}
          </Button>
        </Box>
      )}
    </Box>
  );
}
