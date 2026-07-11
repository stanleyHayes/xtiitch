import type { SvgIconComponent } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { Eyebrow } from "./primitives";
import { riseInSx } from "./shared";

const pageHeroIcons: Record<string, SvgIconComponent> = {
  FAQ: HelpRoundedIcon,
  Features: Inventory2RoundedIcon,
  "For customers": GroupsRoundedIcon,
  Growth: TrendingUpRoundedIcon,
  "How it works": ChecklistRoundedIcon,
  "Payment policy": PaymentsRoundedIcon,
  Pricing: PaymentsRoundedIcon,
  Privacy: SecurityRoundedIcon,
  "Security and trust": SecurityRoundedIcon,
  Terms: ReceiptLongRoundedIcon,
};

export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const Icon = pageHeroIcons[eyebrow] ?? StorefrontRoundedIcon;
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(128,0,32,0.06) 1px, transparent 1px), linear-gradient(180deg, rgba(21,17,26,0.04) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
        }}
      />
      <Container sx={{ position: "relative", py: { xs: 6, md: 10 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "1.12fr 0.88fr" },
            alignItems: "center",
          }}
        >
          <Box sx={{ maxWidth: 820, ...riseInSx(40) }}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontSize: { xs: 38, sm: 48, md: 64 },
                maxWidth: "100%",
                overflowWrap: "break-word",
              }}
            >
              {title}
            </Typography>
            <Typography
              sx={{
                mt: 2.5,
                color: "text.secondary",
                fontSize: { xs: 17, md: 20 },
                maxWidth: 680,
              }}
            >
              {subtitle}
            </Typography>
          </Box>

          <Box
            sx={{
              position: "relative",
              minHeight: { xs: 180, md: 260 },
              overflow: "hidden",
              display: { xs: "none", sm: "block" },
            }}
          >
            <Icon
              sx={{
                position: "absolute",
                right: { sm: 10, md: 20 },
                bottom: { sm: 10, md: 8 },
                fontSize: { sm: 190, md: 248 },
                // Subtle watermark: ink on the light hero, cream on the dark one
                // (a fixed dark rgba vanished on the dark paper).
                color: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 247, 242, 0.14)"
                    : "rgba(21, 17, 26, 0.14)",
                animation: "xtiitch-float-mark 8s ease-in-out infinite",
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none",
                },
              }}
              aria-hidden
            />
            <Stack
              sx={{
                position: "relative",
                p: { sm: 3, md: 4 },
                height: "100%",
                minHeight: { sm: 180, md: 260 },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  left: { sm: 28, md: 34 },
                  top: { sm: 28, md: 34 },
                  width: 88,
                  height: 3,
                  borderRadius: 1,
                  bgcolor: "primary.main",
                  transformOrigin: "left center",
                  animation:
                    "xtiitch-rise-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) 180ms both",
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  left: { sm: 28, md: 34 },
                  top: { sm: 42, md: 50 },
                  width: 42,
                  height: 3,
                  borderRadius: 1,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 247, 242, 0.32)"
                      : "rgba(21, 17, 26, 0.32)",
                  transformOrigin: "left center",
                  animation:
                    "xtiitch-rise-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) 260ms both",
                }}
              />
            </Stack>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
