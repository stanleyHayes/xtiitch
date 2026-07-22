import { useState } from "react";
import { Form, useNavigation } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";

export default function AdminLoginForm({ actionData }: { actionData?: { error?: string } | null }) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  return <Box sx={{ position: "relative", display: "grid", placeItems: "center", p: { xs: 3, sm: 5, xl: 8 }, bgcolor: tokens.panel }}>
    <Box sx={{ width: "100%", maxWidth: 500 }}>
      <Stack direction="row" spacing={1.25} sx={{ display: { xs: "flex", lg: "none" }, alignItems: "center", mb: 6 }}><Box component="img" src="/favicon.svg" alt="Xtiitch" sx={{ width: 44, height: 44, borderRadius: 1.5 }} /><Box><Typography variant="h6" sx={{ lineHeight: 1 }}>Xtiitch</Typography><Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>OPERATIONS</Typography></Box></Stack>
      <Box sx={{ width: 48, height: 48, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: alpha(tokens.burgundy, .09), color: tokens.burgundy, mb: 2.5 }}><ShieldRounded /></Box>
      <Typography variant="overline" sx={{ color: tokens.burgundy, fontWeight: 900, letterSpacing: ".09em" }}>Operator access</Typography>
      <Typography variant="h2" component="h1" sx={{ mt: .5, fontSize: { xs: 38, md: 48 }, lineHeight: .98 }}>Welcome back.</Typography>
      <Typography sx={{ mt: 1.5, color: "text.secondary", maxWidth: 420 }}>Use your authorised Xtiitch admin credentials to continue.</Typography>
      <Form method="post"><Stack spacing={2} sx={{ mt: 4 }}>
        {actionData?.error ? <Alert severity="error">{actionData.error}</Alert> : null}
        <TextField name="email" label="Operator email" type="email" required autoComplete="email" fullWidth slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailRounded /></InputAdornment> } }} />
        <TextField name="password" label="Password" type={showPassword ? "text" : "password"} required autoComplete="current-password" fullWidth slotProps={{ input: { startAdornment: <InputAdornment position="start"><LockRounded /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} edge="end"><>{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</></IconButton></InputAdornment> } }} />
        <Button type="button" variant="text" size="small" onClick={() => setShowHelp((value) => !value)} sx={{ alignSelf: "flex-end", px: .5 }}>Forgot password?</Button>
        {showHelp ? <Alert severity="info">Ask the platform owner to reset your managed operator account.</Alert> : null}
        <Button type="submit" variant="contained" size="large" disabled={submitting} endIcon={submitting ? undefined : <ArrowForwardRounded />} sx={{ minHeight: 52, whiteSpace: "nowrap", "&.Mui-disabled": { bgcolor: tokens.burgundy, color: tokens.white, opacity: .7 } }}>{submitting ? "Opening console…" : "Open console"}</Button>
      </Stack></Form>
      <Typography variant="caption" sx={{ display: "block", mt: 3, color: "text.secondary", textAlign: "center" }}>Protected session · Role-based access · Audited actions</Typography>
    </Box>
  </Box>;
}
