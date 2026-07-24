import type { MetaDescriptor } from "react-router";
import { useRouteLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import PrivacyTipRoundedIcon from "@mui/icons-material/PrivacyTipRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { pageMeta } from "../components/seo";
import { PageHero, Section } from "../components/ui";
import { site } from "../content";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Contact Xtiitch",
    description:
      "Create your Xtiitch store or reach the team for support, billing, privacy, or general enquiries.",
    path: "/contact",
  });
}

// The five public channels (Updates Doc §5). Emails open the mail client;
// WhatsApp uses the wa.me deep link (Ghana number in international form).
const contactChannels = [
  {
    channel: "General",
    address: "hello@xtiitch.com",
    href: "mailto:hello@xtiitch.com",
    note: "General enquiries",
    icon: <MailRoundedIcon />,
  },
  {
    channel: "Support",
    address: "support@xtiitch.com",
    href: "mailto:support@xtiitch.com",
    note: "Help using the platform",
    icon: <SupportAgentRoundedIcon />,
  },
  {
    channel: "Billing",
    address: "billing@xtiitch.com",
    href: "mailto:billing@xtiitch.com",
    note: "Payments, subscriptions, payouts",
    icon: <ReceiptLongRoundedIcon />,
  },
  {
    channel: "Privacy",
    address: "privacy@xtiitch.com",
    href: "mailto:privacy@xtiitch.com",
    note: "Data protection requests",
    icon: <PrivacyTipRoundedIcon />,
  },
  {
    channel: "WhatsApp",
    address: "0594667183",
    href: "https://wa.me/233594667183",
    note: "Quick help",
    icon: <WhatsAppIcon />,
  },
] as const;

export default function Contact() {
  const rootData = useRouteLoaderData("root") as
    | { signupUrl?: string }
    | undefined;
  const signupUrl = rootData?.signupUrl ?? site.primaryCta.href;

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Start your store or talk to us"
        subtitle="Registration is open, and the Xtiitch team is a message away when you need help."
      />
      <Section>
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 3.5 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "rgba(var(--surface-rgb), 0.9)",
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 2.5,
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Box
                aria-hidden
                sx={{
                  width: 48,
                  height: 48,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 1,
                  color: "primary.main",
                  bgcolor: "rgba(128,0,32,0.08)",
                  flexShrink: 0,
                }}
              >
                <StorefrontRoundedIcon />
              </Box>
              <Box>
                <Typography variant="h5" component="h2">
                  Create your store
                </Typography>
                <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                  Start free, publish your storefront, upgrade when it helps.
                </Typography>
              </Box>
            </Stack>
            <Button
              component="a"
              href={signupUrl}
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ flexShrink: 0 }}
            >
              Start for free
            </Button>
          </Paper>

          <Box>
            <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
              Ways to reach us
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
              }}
            >
              {contactChannels.map((channel) => (
                <Paper
                  key={channel.channel}
                  component="a"
                  href={channel.href}
                  {...(channel.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  elevation={0}
                  sx={{
                    p: 2.25,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    bgcolor: "rgba(var(--surface-rgb), 0.9)",
                    display: "flex",
                    gap: 1.75,
                    alignItems: "center",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "border-color 120ms ease",
                    "&:hover": { borderColor: "primary.main" },
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 40,
                      height: 40,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 1,
                      color: "primary.main",
                      bgcolor: "rgba(128,0,32,0.08)",
                      flexShrink: 0,
                    }}
                  >
                    {channel.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "baseline", flexWrap: "wrap" }}
                    >
                      <Typography sx={{ fontWeight: 700 }}>
                        {channel.channel}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        {channel.note}
                      </Typography>
                    </Stack>
                    <Typography sx={{ color: "primary.main" }} noWrap>
                      {channel.address}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        </Stack>
      </Section>
    </>
  );
}
