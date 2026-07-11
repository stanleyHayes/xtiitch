import { useState } from "react";
import { Form, useNavigation } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import { alpha } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";

type AdminLoginFormProps = {
  actionData?: { error?: string } | null;
};

function LoadingButtonLabel({ label }: { label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.85,
        "@keyframes xtiitchButtonDot": {
          "0%, 80%, 100%": { opacity: 0.42, transform: "translateY(0)" },
          "40%": { opacity: 1, transform: "translateY(-4px)" },
        },
      }}
    >
      <Box component="span">{label}</Box>
      <Box
        component="span"
        aria-hidden
        sx={{ display: "inline-flex", gap: 0.45, pt: "2px" }}
      >
        {["0ms", "120ms", "240ms"].map((delay) => (
          <Box
            key={delay}
            component="span"
            sx={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              bgcolor: "currentColor",
              animation: `xtiitchButtonDot 900ms ease-in-out ${delay} infinite`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

export default function AdminLoginForm({ actionData }: AdminLoginFormProps) { // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);
  const [showResetHelp, setShowResetHelp] = useState(false);

  return (
    <Box
      sx={{
        position: "relative",
        bgcolor: tokens.panel,
        display: "grid",
        placeItems: "center",
        px: { xs: 2.5, sm: 4, md: 6 },
        py: { xs: 4, md: 7 },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(21,17,26,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(21,17,26,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "34px 34px",
          pointerEvents: "none",
        }}
      />

      <Paper
        elevation={0}
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 500,
          p: { xs: 3, md: 4 },
          border: "1px solid",
          borderColor: alpha(tokens.ink, 0.1),
          borderRadius: 2,
          boxShadow: `0 28px 70px ${alpha(tokens.ink, 0.1)}`,
        }}
      >
        <Stack spacing={2.5}>
          {/* Compact brand, mobile only (the side panel is hidden < lg). */}
          <Stack
            direction="row"
            spacing={1.25}
            sx={{
              display: { xs: "flex", lg: "none" },
              alignItems: "center",
            }}
          >
            <Box
              component="img"
              src="/favicon.svg"
              alt="Xtiitch"
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                display: "block",
              }}
            />
            <Typography variant="h6" sx={{ lineHeight: 1 }}>
              Xtiitch Admin
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center" }}
          >
            <Box
              component="img"
              src="/favicon.svg"
              alt="Xtiitch"
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2,
                display: "block",
              }}
            />
            <Box>
              <Typography
                variant="overline"
                sx={{
                  color: "text.secondary",
                  fontWeight: 900,
                  letterSpacing: 0,
                }}
              >
                Operator access
              </Typography>
              <Typography
                variant="h4"
                component="h2"
                sx={{ lineHeight: 1.04 }}
              >
                Sign in to Admin
              </Typography>
            </Box>
          </Stack>

          <Divider />

          <Form method="post">
            <Stack spacing={2.25}>
              {actionData?.error ? (
                <Alert severity="error">{actionData.error}</Alert>
              ) : null}
              <TextField
                name="email"
                label="Operator email"
                type="email"
                required
                autoComplete="email"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailRounded />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                name="password"
                label="Password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockRounded />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          tabIndex={-1}
                          sx={{ color: "text.secondary" }}
                        >
                          {showPassword ? (
                            <VisibilityOffRounded />
                          ) : (
                            <VisibilityRounded />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="button"
                  variant="text"
                  size="small"
                  onClick={() => setShowResetHelp((v) => !v)}
                  sx={{
                    color: "primary.main",
                    fontWeight: 700,
                    textTransform: "none",
                    px: 0.5,
                    minWidth: 0,
                  }}
                >
                  Forgot password?
                </Button>
              </Box>
              {showResetHelp ? (
                <Alert severity="info">
                  Operator accounts are managed. Ask the platform owner to
                  reset your password (or re-issue it via ADMIN_BOOTSTRAP).
                </Alert>
              ) : null}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                endIcon={isSubmitting ? undefined : <ArrowForwardRounded />}
                sx={{
                  minHeight: 48,
                  "&.Mui-disabled": {
                    bgcolor: tokens.burgundy,
                    color: tokens.white,
                    opacity: 0.72,
                  },
                }}
              >
                {isSubmitting ? (
                  <LoadingButtonLabel label="Opening console" />
                ) : (
                  "Open console"
                )}
              </Button>
            </Stack>
          </Form>

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(tokens.burgundy, 0.045),
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.12),
            }}
          >
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "flex-start" }}
            >
              <ShieldRounded sx={{ color: tokens.burgundy, mt: 0.25 }} />
              <Box>
                <Typography sx={{ fontWeight: 900 }}>
                  Protected operator session
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.5, color: "text.secondary" }}
                >
                  Access tokens stay server-side in the signed admin
                  session.
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Chip
              icon={<ShieldRounded />}
              label="HttpOnly"
              variant="outlined"
            />
            <Chip
              icon={<VerifiedUserRounded />}
              label="RBAC"
              variant="outlined"
            />
            <Chip
              icon={<AdminPanelSettingsRounded />}
              label="Audit trail"
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
