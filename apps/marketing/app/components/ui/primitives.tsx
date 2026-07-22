import type { ReactNode } from "react";
import { Link as RouterLink, useRouteLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import type { SxProps, Theme } from "@mui/material/styles";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { site } from "../../content";
import { riseInSx } from "./shared";

export function Eyebrow({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "light";
}) {
  const isLight = tone === "light";
  return (
    <Typography
      component="p"
      sx={{
        textTransform: "uppercase",
        letterSpacing: 0,
        fontSize: 11,
        fontWeight: 800,
        color: isLight ? "common.white" : "primary.main",
        mb: 1.5,
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        "&:before": {
          content: '""',
          width: 28,
          height: 2,
          borderRadius: 1,
          bgcolor: isLight ? "common.white" : "primary.main",
        },
      }}
    >
      {children}
    </Typography>
  );
}

export function Section({
  children,
  alt,
  sx,
}: {
  children: ReactNode;
  alt?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        py: { xs: 6, md: 10 },
        overflow: "hidden",
        bgcolor: alt ? "background.paper" : "background.default",
        borderTop: alt ? "1px solid" : "none",
        borderBottom: alt ? "1px solid" : "none",
        borderColor: "divider",
        "&:before": alt
          ? {
              content: '""',
              position: "absolute",
              inset: 0,
              opacity: 0.72,
              background: [
                "linear-gradient(90deg, rgba(128,0,32,0.035) 1px, transparent 1px)",
                "linear-gradient(180deg, rgba(21,17,26,0.026) 1px, transparent 1px)",
                "radial-gradient(circle, rgba(128,0,32,0.09) 1px, transparent 1.5px)",
              ].join(", "),
              backgroundSize: "42px 42px, 42px 42px, 14px 14px",
              animation: "xtiitch-thread-drift 24s linear infinite",
              pointerEvents: "none",
              "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
              },
            }
          : undefined,
        ...sx,
      }}
    >
      <Container sx={{ position: "relative" }}>{children}</Container>
    </Box>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  const isCenter = align === "center";
  return (
    <Box
      sx={{
        maxWidth: 820,
        mx: isCenter ? "auto" : 0,
        textAlign: align,
        mb: { xs: 4, md: 6 },
        ...riseInSx(40),
      }}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Typography variant="h2" component="h2">
        {title}
      </Typography>
      {subtitle ? (
        <Typography
          sx={{
            mt: 2,
            color: "text.secondary",
            fontSize: { xs: 16, md: 18 },
            maxWidth: 700,
            mx: isCenter ? "auto" : 0,
          }}
        >
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}

export function CtaRow({
  align = "flex-start",
}: {
  align?: "flex-start" | "center";
}) {
  const rootData = useRouteLoaderData("root") as
    | { signupUrl?: string }
    | undefined;
  const signupUrl = rootData?.signupUrl ?? site.primaryCta.href;
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{
        justifyContent: align,
        alignItems: { xs: "stretch", sm: "center" },
      }}
    >
      <Button
        component="a"
        href={signupUrl}
        variant="contained"
        size="large"
        endIcon={<ArrowForwardRoundedIcon />}
      >
        {site.primaryCta.label}
      </Button>
      <Button
        component={RouterLink}
        to={site.secondaryCta.href}
        variant="outlined"
        size="large"
      >
        {site.secondaryCta.label}
      </Button>
    </Stack>
  );
}
