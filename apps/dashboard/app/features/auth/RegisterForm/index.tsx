import { useEffect, useState } from "react";
import { Form, useRouteLoaderData } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../../theme";
import { phoneStepComplete } from "../../../lib/phone-verification";
import { RegisterStepAccount } from "../RegisterStepAccount";
import { RegisterStepPlan } from "../RegisterStepPlan";
import { RegisterStepStore } from "../RegisterStepStore";
import { STEP_LABELS } from "../Register";
import { RegisterActions } from "./RegisterActions";
import { RegisterStepIndicator } from "./RegisterStepIndicator";
import { usePhoneVerification } from "./use-phone-verification";

export function RegisterForm({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  plans,
  isSubmitting,
  result,
}: {
  plans: { code: string; name: string; monthly_fee_minor: number; commission_bps: number; design_limit?: number | null }[];
  isSubmitting: boolean;
  result: { error?: string };
}) {
  const branding = useRouteLoaderData("root") as
    | { brandLogoUrl?: string }
    | undefined;
  const brandLogoUrl = branding?.brandLogoUrl ?? "";

  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [handle, setHandle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");

  const handleOk = /^[a-z0-9-]{2,}$/.test(handle.trim().toLowerCase());
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordOk = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const whatsappOk = whatsappNumber.replace(/[^0-9]/g, "").length >= 9;
  const phoneOk = ownerPhone.replace(/[^0-9]/g, "").length >= 9;

  // §8 phone verification replaces the old fire-and-forget OTP bits
  // (otpRequested / whatsappCode / otpError) with one reducer-driven state
  // machine — the hook owns the send/auto-verify plumbing, the transitions
  // live in app/lib/phone-verification.ts.
  const {
    verification,
    sendPhoneCode,
    handleOwnerPhoneChange,
    handleCodeChange,
    changePhone,
  } = usePhoneVerification(ownerPhone, phoneOk, setOwnerPhone);

  const [handleStatus, setHandleStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "reserved" | "error"
  >("idle");

  useEffect(() => {
    const normalized = handle.trim().toLowerCase();
    if (!handleOk) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/handle-check?handle=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((data: { available?: boolean; reason?: string }) => {
          if (data.available) {
            setHandleStatus("available");
          } else if (data.reason === "reserved") {
            setHandleStatus("reserved");
          } else {
            setHandleStatus("taken");
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setHandleStatus("error");
          }
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [handle, handleOk]);

  const handleUnavailable =
    handleStatus === "taken" || handleStatus === "reserved";
  const step0Valid =
    businessName.trim().length > 1 && handleOk && !handleUnavailable;
  // The phone is OPTIONAL (the API accepts signup without one) — but once a
  // number IS entered, §8 makes verification the gate: the step only advances
  // after the code verifies, not merely after a code was requested.
  const phoneProvided = ownerPhone.trim().length > 0;
  const phoneStepOk =
    !phoneProvided || (phoneOk && phoneStepComplete(verification));
  const whatsappStepOk = !whatsappNumber.trim() || whatsappOk;
  const step1Valid =
    ownerName.trim().length > 0 &&
    emailOk &&
    passwordOk &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    phoneStepOk &&
    whatsappStepOk;
  const step2Valid = plans.length === 0 || selectedPlan !== "";

  const goNext = () => setStep((s) => Math.min(s + 1, 2));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.055)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.055)} 1px, transparent 1px)`,
        backgroundSize: "34px 34px",
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          minHeight: "100vh",
          display: "grid",
          alignItems: "center",
          py: { xs: 4, md: 7 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.12),
            borderRadius: 3,
            bgcolor: alpha(tokens.white, 0.98),
            color: tokens.ink,
            boxShadow: `0 28px 72px ${alpha(tokens.ink, 0.16)}`,
            "& .MuiInputLabel-root": {
              color: alpha(tokens.ink, 0.68),
              bgcolor: alpha(tokens.white, 0.98),
              px: 0.75,
              ml: -0.75,
              borderRadius: 1,
              "&.Mui-focused": { color: tokens.burgundy },
            },
            "& .MuiOutlinedInput-root": {
              bgcolor: tokens.white,
              color: tokens.ink,
              borderRadius: 2,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: alpha(tokens.ink, 0.22),
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: alpha(tokens.burgundy, 0.5),
              },
              "&.Mui-focused": {
                boxShadow: `0 0 0 4px ${alpha(tokens.burgundy, 0.12)}`,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: tokens.burgundy,
                },
              },
            },
            "& .MuiInputAdornment-root, & .MuiSvgIcon-root": {
              color: alpha(tokens.ink, 0.62),
            },
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", mb: 2.5 }}
          >
            {brandLogoUrl ? (
              <Box
                component="img"
                src={brandLogoUrl}
                alt="Xtiitch"
                sx={{
                  height: 32,
                  width: "auto",
                  maxWidth: 150,
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
            ) : (
              <Box
                component="img"
                src="/favicon.svg"
                alt="Xtiitch"
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  flexShrink: 0,
                  display: "block",
                }}
              />
            )}
            <Box>
              {brandLogoUrl ? null : (
                <Typography sx={{ fontWeight: 800, lineHeight: 1 }}>
                  Xtiitch
                </Typography>
              )}
              <Typography
                variant="caption"
                sx={{ color: alpha(tokens.ink, 0.68) }}
              >
                Business dashboard
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={0.75} sx={{ mb: 2.5 }}>
            <Chip
              label="Create your store"
              color="primary"
              sx={{ alignSelf: "flex-start" }}
            />
            <Typography variant="h4" component="h1">
              Start selling on Xtiitch
            </Typography>
            <Typography sx={{ color: alpha(tokens.ink, 0.68) }}>
              Free to start — your storefront goes live at{" "}
              <strong>your-handle.xtiitch.com</strong>.
            </Typography>
          </Stack>

          <RegisterStepIndicator step={step} labels={STEP_LABELS} />

          {result.error ? (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {result.error}
            </Alert>
          ) : null}

          <Form method="post">
            {/* Each step renders conditionally, so a step's inputs are unmounted
                while it isn't visible — and the submit happens on the LAST step,
                where the store/account fields no longer exist in the DOM. These
                hidden inputs (bound to state) carry every value into the submit so
                nothing is dropped (previously the password/email/name arrived
                empty, e.g. "choose a password with at least 8 characters"). */}
            <input type="hidden" name="business_name" value={businessName} />
            <input type="hidden" name="business_handle" value={handle} />
            <input type="hidden" name="owner_display_name" value={ownerName} />
            <input type="hidden" name="owner_email" value={email} />
            <input type="hidden" name="owner_password" value={password} />
            <input type="hidden" name="owner_phone" value={ownerPhone} />
            <input type="hidden" name="whatsapp_number" value={whatsappNumber} />
            {/* Kept for backward compatibility: the API accepts a verified
                phone with or without the code, and an unverified one with it. */}
            <input
              type="hidden"
              name="owner_phone_code"
              value={verification.code}
            />
            {step === 0 ? (
              <RegisterStepStore
                businessName={businessName}
                onBusinessNameChange={setBusinessName}
                handle={handle}
                onHandleChange={setHandle}
                handleStatus={handleStatus}
                handleOk={handleOk}
                handleUnavailable={handleUnavailable}
              />
            ) : null}
            {step === 1 ? (
              <RegisterStepAccount
                ownerName={ownerName}
                onOwnerNameChange={setOwnerName}
                email={email}
                onEmailChange={setEmail}
                ownerPhone={ownerPhone}
                onOwnerPhoneChange={handleOwnerPhoneChange}
                whatsappNumber={whatsappNumber}
                onWhatsappNumberChange={setWhatsappNumber}
                verification={verification}
                onCodeChange={handleCodeChange}
                onRequestOtp={sendPhoneCode}
                onChangePhone={changePhone}
                password={password}
                onPasswordChange={setPassword}
                confirmPassword={confirmPassword}
                onConfirmPasswordChange={setConfirmPassword}
                showPassword={showPassword}
                onToggleShowPassword={() => setShowPassword((v) => !v)}
                emailOk={emailOk}
                passwordOk={passwordOk}
                passwordsMatch={passwordsMatch}
                whatsappOk={whatsappOk}
                phoneOk={phoneOk}
              />
            ) : null}
            {step === 2 ? (
              <RegisterStepPlan
                plans={plans}
                selectedPlan={selectedPlan}
                onSelectPlan={setSelectedPlan}
              />
            ) : null}

            <RegisterActions
              step={step}
              isSubmitting={isSubmitting}
              step0Valid={step0Valid}
              step1Valid={step1Valid}
              step2Valid={step2Valid}
              onBack={goBack}
              onNext={goNext}
            />
          </Form>
        </Paper>
      </Container>
    </Box>
  );
}
