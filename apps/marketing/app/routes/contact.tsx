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

export default function Contact() {
  return (
    <Box sx={{ bgcolor: "background.default", py: { xs: 6, md: 9 } }}>
      <Container>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "start",
          }}
        >
          <Box>
            <Eyebrow>Join the waitlist</Eyebrow>
            <Typography
              variant="h1"
              component="h1"
              sx={{ fontSize: { xs: 32, md: 42 } }}
            >
              Get your fashion business online
            </Typography>
            <Typography
              sx={{
                mt: 2.5,
                color: "text.secondary",
                fontSize: { xs: 17, md: 19 },
              }}
            >
              Leave your details and we’ll help you set up a real store, take
              payment, and give your customers a clear view of their orders.
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 4 }}>
              {reassurance.map((line) => (
                <Box
                  key={line}
                  sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}
                >
                  <CheckCircleRoundedIcon
                    sx={{ color: "success.main", mt: "2px" }}
                    aria-hidden
                  />
                  <Typography sx={{ color: "text.secondary" }}>
                    {line}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <WaitlistForm />
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
