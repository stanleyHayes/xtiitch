import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import { getXtiitchThemeColors } from "@xtiitch/design-tokens";
import type { Theme } from "@mui/material/styles";
import { tokens } from "../../theme";
import AdminLoginForm from "./AdminLoginForm";

type AdminLoginProps = { actionData?: { error?: string } | null };

// `tokens` is the STATIC palette — one fixed set of values, no light/dark
// variants. The MUI theme, meanwhile, follows the operator's saved mode. This
// page painted its shell, card and form panel from `tokens` (cream / white),
// so with dark mode saved the theme rendered dark fields and muted-on-dark
// text on top of a hardcoded light page: black input boxes on cream, and body
// copy that vanished entirely.
//
// Anything that has to agree with the theme reads the per-mode set instead.
// The left brand panel stays deliberately charcoal in both modes; it is a
// brand surface, not page chrome.
const modeColors = (theme: Theme) => getXtiitchThemeColors(theme.palette.mode);

export default function AdminLogin({ actionData }: AdminLoginProps) {
  const assurances = ["Role-based operator access", "Server-side session protection", "Every sensitive action audited"];
  return <Box sx={{ minHeight: "100vh", p: { xs: 1.25, md: 2.5 }, bgcolor: (theme) => modeColors(theme).background, color: (theme) => modeColors(theme).text, display: "grid", placeItems: "center" }}>
    <Box sx={{ width: "100%", maxWidth: 1440, minHeight: { xs: "calc(100vh - 20px)", md: "min(820px, calc(100vh - 40px))" }, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.08fr) minmax(420px, .92fr)" }, overflow: "hidden", borderRadius: { xs: 2, md: 3 }, border: "1px solid", borderColor: (theme) => modeColors(theme).border, bgcolor: (theme) => modeColors(theme).surface, boxShadow: (theme) => `0 36px 110px ${modeColors(theme).shadow}` }}>
      <Box sx={{ display: { xs: "none", lg: "flex" }, position: "relative", overflow: "hidden", p: { lg: 5, xl: 7 }, flexDirection: "column", justifyContent: "space-between", color: tokens.white, bgcolor: tokens.charcoal }}>
        <AdminPanelSettingsRounded aria-hidden sx={{ position: "absolute", right: -72, bottom: -60, fontSize: 430, color: alpha(tokens.white, .035), transform: "rotate(-8deg)" }} />
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", position: "relative" }}><Box component="img" src="/favicon.svg" alt="Xtiitch" sx={{ width: 50, height: 50, borderRadius: 2 }} /><Box><Typography variant="h6" sx={{ lineHeight: 1 }}>Xtiitch</Typography><Typography variant="caption" sx={{ color: alpha(tokens.white, .58), fontWeight: 900, letterSpacing: ".16em" }}>OPERATIONS</Typography></Box></Stack>
        <Box sx={{ position: "relative", maxWidth: 650 }}><Chip icon={<ShieldRounded />} label="Restricted operator entry" sx={{ mb: 3, bgcolor: alpha(tokens.white, .09), color: tokens.white, border: "1px solid", borderColor: alpha(tokens.white, .14), "& .MuiChip-icon": { color: tokens.gold } }} /><Typography variant="h1" sx={{ fontSize: { lg: 56, xl: 72 }, lineHeight: .94 }}>The control room starts here.</Typography><Typography sx={{ mt: 3, maxWidth: 560, fontSize: 18, lineHeight: 1.65, color: alpha(tokens.white, .68) }}>Sign in to monitor the platform, resolve operational work, and protect every store from one focused workspace.</Typography></Box>
        <Stack spacing={1.35} sx={{ position: "relative" }}>{assurances.map((label) => <Stack key={label} direction="row" spacing={1.25} sx={{ alignItems: "center" }}><CheckCircleRounded sx={{ color: tokens.gold, fontSize: 20 }} /><Typography sx={{ color: alpha(tokens.white, .78), fontWeight: 800 }}>{label}</Typography></Stack>)}</Stack>
      </Box>
      <AdminLoginForm actionData={actionData} />
    </Box>
  </Box>;
}
