import type { MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { pageMeta } from "../components/seo";
import { Eyebrow } from "../components/ui";
import { WaitlistForm } from "../components/waitlist-form";
import {
  parseWaitlist,
  submitWaitlistLead,
  type WaitlistResult,
} from "../lib/waitlist";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Join the waitlist",
    description:
      "Tell us about your fashion business and join the Xtiitch waitlist. We’ll set you up with your store as onboarding opens.",
    path: "/contact",
  });
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<WaitlistResult> {
  const formData = await request.formData();
  const parsed = parseWaitlist(formData);

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const delivery = await submitWaitlistLead(parsed.values, request);
  if (!delivery.ok) {
    return { ok: false, errors: { form: delivery.message } };
  }

  return { ok: true };
}

const reassurance: string[] = [
  "We’ll reach out as onboarding opens for new businesses.",
  "Setup is guided — your store, sizes and first designs.",
  "No monthly cost to start on the Free plan.",
  "Your details are only used to set up and reach you.",
];

const launchSteps = ["Request", "Guided setup", "Store live"] as const;

export default function Contact() {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: "background.default",
        py: { xs: 6, md: 9 },
        "&:before": {
          content: '""',
          position: "absolute",
          inset: 0,
          opacity: 0.65,
          background:
            "linear-gradient(90deg, rgba(128,0,32,0.035) 1px, transparent 1px), linear-gradient(180deg, rgba(21,17,26,0.026) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          pointerEvents: "none",
        },
      }}
    >
      <Container sx={{ position: "relative" }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "0.95fr 1.05fr" },
            alignItems: "start",
          }}
        >
          <Box
            sx={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              minHeight: { xs: 560, md: 720 },
              bgcolor: "secondary.main",
              color: "common.white",
              boxShadow: "0 34px 90px -58px rgba(21,17,26,0.74)",
            }}
          >
            <Box
              component="img"
              src="/images/atelier-hero.webp"
              alt="Fashion atelier with burgundy garments and a sewing machine"
              loading="lazy"
              decoding="async"
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(21,17,26,0.22), rgba(21,17,26,0.88)), linear-gradient(90deg, rgba(128,0,32,0.34), rgba(21,17,26,0.12))",
              }}
            />
            <Box
              sx={{
                position: "relative",
                minHeight: { xs: 560, md: 720 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                p: { xs: 3, md: 4 },
              }}
            >
              <Box>
                <Eyebrow tone="light">Join the waitlist</Eyebrow>
                <Typography
                  variant="h1"
                  component="h1"
                  sx={{ fontSize: { xs: 42, md: 60 }, maxWidth: 560 }}
                >
                  Get your fashion business online
                </Typography>
                <Typography
                  sx={{
                    mt: 2.5,
                    color: "rgba(255,255,255,0.78)",
                    fontSize: { xs: 17, md: 19 },
                    maxWidth: 560,
                  }}
                >
                  Leave your details and we’ll help you set up a real store,
                  take payment, and give your customers a clear view of their
                  orders.
                </Typography>
              </Box>
              <Stack spacing={1.25} sx={{ mt: 4 }}>
                {reassurance.map((line) => (
                  <Box
                    key={line}
                    sx={{
                      display: "flex",
                      gap: 1.5,
                      alignItems: "flex-start",
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
                  >
                    <CheckCircleRoundedIcon
                      sx={{ color: "success.light", mt: "2px" }}
                      aria-hidden
                    />
                    <Typography sx={{ color: "rgba(255,255,255,0.84)" }}>
                      {line}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              <Box
                sx={{
                  mt: 3,
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  borderRadius: 1,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.14)",
                  bgcolor: "rgba(21,17,26,0.36)",
                }}
              >
                {launchSteps.map((step, index) => (
                  <Box
                    key={step}
                    sx={{
                      p: { xs: 1.25, md: 1.5 },
                      borderRight:
                        index === launchSteps.length - 1
                          ? "none"
                          : "1px solid rgba(255,255,255,0.14)",
                    }}
                  >
                    <Typography
                      component="p"
                      sx={{
                        color: "rgba(255,255,255,0.52)",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 0.5,
                        color: "rgba(255,255,255,0.86)",
                        fontWeight: 800,
                      }}
                    >
                      {step}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "rgba(255,255,255,0.9)",
              boxShadow: "0 28px 80px -58px rgba(21,17,26,0.64)",
              position: { md: "sticky" },
              top: { md: 110 },
            }}
          >
            <WaitlistForm />
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
