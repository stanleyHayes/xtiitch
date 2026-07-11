import { Link as RouterLink } from "react-router";
import Button from "@mui/material/Button";
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
      <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
        {step > 0 ? (
          <Button
            type="button"
            variant="outlined"
            size="large"
            onClick={onBack}
            disabled={isSubmitting}
            startIcon={<ArrowBackRounded />}
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
              flex: 1,
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
            endIcon={isSubmitting ? undefined : <ArrowForwardRounded />}
            sx={{
              flex: 1,
              "&.Mui-disabled": {
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
