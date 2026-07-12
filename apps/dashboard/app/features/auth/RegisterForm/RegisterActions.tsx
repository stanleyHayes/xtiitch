import { Link as RouterLink } from "react-router";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { tokens } from "../../../theme";

export function RegisterActions({
  step,
  isSubmitting,
  step0Valid,
  step1Valid,
  step2Valid,
  onBack,
  onNext,
}: {
  step: number;
  isSubmitting: boolean;
  step0Valid: boolean;
  step1Valid: boolean;
  step2Valid: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      {/* Stacked (full-width, primary on top) on mobile; side by side from `sm`
          up. Side-by-side was cramped on phones and wrapped the CTA label. */}
      <Stack
        direction={{ xs: "column-reverse", sm: "row" }}
        spacing={1.5}
        sx={{ mt: 3 }}
      >
        {step > 0 ? (
          <Button
            type="button"
            variant="outlined"
            size="large"
            onClick={onBack}
            disabled={isSubmitting}
            startIcon={<ArrowBackRounded />}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Back
          </Button>
        ) : null}
        {step < 2 ? (
          <Button
            type="button"
            variant="contained"
            size="large"
            onClick={onNext}
            disabled={step === 0 ? !step0Valid : !step1Valid}
            endIcon={<ArrowForwardRounded />}
            sx={{
              flex: { sm: 1 },
              width: { xs: "100%", sm: "auto" },
              "&.Mui-disabled": {
                bgcolor: alpha(tokens.burgundy, 0.14),
                color: alpha(tokens.burgundy, 0.55),
              },
            }}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting || !step2Valid}
            endIcon={
              isSubmitting ? (
                <CircularProgress size={18} thickness={5} color="inherit" />
              ) : (
                <ArrowForwardRounded />
              )
            }
            sx={{
              flex: { sm: 1 },
              width: { xs: "100%", sm: "auto" },
              // While submitting the button stays disabled (no double-submit) but
              // keeps the active burgundy look + spinner so the loading state is
              // obvious; the faded style is only for the "no plan selected" state.
              "&.Mui-disabled": isSubmitting
                ? { bgcolor: tokens.burgundy, color: tokens.white, opacity: 1 }
                : {
                    bgcolor: alpha(tokens.burgundy, 0.14),
                    color: alpha(tokens.burgundy, 0.55),
                  },
            }}
          >
            {isSubmitting
              ? "Creating your store…"
              : !step2Valid
                ? "Select a plan to continue"
                : "Create store"}
          </Button>
        )}
      </Stack>

      <Typography
        variant="body2"
        sx={{
          textAlign: "center",
          color: alpha(tokens.ink, 0.68),
          mt: 2.5,
        }}
      >
        Already have a store?{" "}
        <Link component={RouterLink} to="/login" sx={{ fontWeight: 700 }}>
          Sign in
        </Link>
      </Typography>
    </>
  );
}
