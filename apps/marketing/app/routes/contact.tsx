import type { MetaDescriptor } from "react-router";
import { useRouteLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
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

type ContactChannel = (typeof contactChannels)[number];

// The signup panel and the channel cards are split out so each stays readable
// on its own; the page component is then just the two-column layout that
// arranges them. Purely structural — the markup and styling below are the
// redesign as authored.
function ContactPromoPanel({ signupUrl }: { signupUrl: string }) {
  return (
    <Box
      component="aside"
      sx={{
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        minHeight: { xs: 420, lg: 560 },
        p: { xs: 3.5, sm: 5, lg: 5 },
        borderRadius: { xs: 2, md: 3 },
        bgcolor: "primary.main",
        color: "primary.contrastText",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundImage: (theme) =>
          `radial-gradient(circle at 90% 5%, ${alpha(theme.palette.common.white, 0.18)}, transparent 30%), radial-gradient(circle at 10% 90%, ${alpha(theme.palette.common.black, 0.18)}, transparent 38%)`,
      }}
    >
      <Typography
        aria-hidden
        sx={{
          position: "absolute",
          zIndex: -1,
          right: -24,
          bottom: -28,
          color: "inherit",
          fontFamily: "var(--font-display, inherit)",
          fontSize: { xs: 94, sm: 132, lg: 112 },
          fontWeight: 900,
          lineHeight: 0.8,
          letterSpacing: "-0.04em",
          opacity: 0.07,
          writingMode: { lg: "vertical-rl" },
        }}
      >
        HELLO
      </Typography>

      <Box>
        <Box
          aria-hidden
          sx={{
            width: 56,
            height: 56,
            display: "grid",
            placeItems: "center",
            borderRadius: 1.5,
            color: "inherit",
            bgcolor: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.22)",
          }}
        >
          <StorefrontRoundedIcon />
        </Box>
        <Typography
          component="h2"
          sx={{
            mt: 4,
            maxWidth: 420,
            fontFamily: "var(--font-display, inherit)",
            fontSize: { xs: "2.35rem", sm: "3rem", lg: "3.25rem" },
            fontWeight: 800,
            lineHeight: 1,
            textWrap: "balance",
          }}
        >
          Ready to open your studio online?
        </Typography>
        <Typography
          sx={{
            mt: 2.25,
            maxWidth: 400,
            color: "rgba(255,255,255,0.76)",
            lineHeight: 1.7,
          }}
        >
          Start free, publish your storefront, and upgrade only when the extra
          tools earn their place.
        </Typography>
      </Box>

      <Box sx={{ mt: 5 }}>
        <Button
          component="a"
          href={signupUrl}
          variant="outlined"
          endIcon={<ArrowForwardRoundedIcon />}
          sx={{
            minHeight: 52,
            px: 3,
            color: "inherit",
            borderColor: "rgba(255,255,255,0.5)",
            bgcolor: "rgba(255,255,255,0.08)",
            "&:hover": {
              borderColor: "white",
              bgcolor: "rgba(255,255,255,0.15)",
            },
          }}
        >
          Create your store
        </Button>
        <Typography
          variant="body2"
          sx={{ mt: 2, color: "rgba(255,255,255,0.68)" }}
        >
          No package charge to get online.
        </Typography>
      </Box>
    </Box>
  );
}

// `emphasised` gives the first two channels — the ones most people want — a
// taller card and a stronger tint.
function ContactChannelCard({
  channel,
  emphasised,
}: {
  channel: ContactChannel;
  emphasised: boolean;
}) {
  const isExternal = channel.href.startsWith("http");
  return (
    <Paper
      component="a"
      href={channel.href}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: emphasised ? 174 : 150,
        p: { xs: 2.5, md: 3 },
        border: 0,
        borderRadius: 2,
        bgcolor: (theme) =>
          alpha(theme.palette.primary.main, emphasised ? 0.07 : 0.035),
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        textDecoration: "none",
        color: "inherit",
        transition:
          "transform 220ms ease, background-color 220ms ease, box-shadow 220ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.11),
          boxShadow: (theme) =>
            `0 20px 38px -28px ${alpha(theme.palette.primary.dark, 0.65)}`,
          "& .contact-arrow": { transform: "translate(3px, -3px)" },
        },
        "&:focus-visible": {
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: 3,
        },
      }}
    >
      <Stack
        direction="row"
        sx={{ width: "100%", justifyContent: "space-between" }}
      >
        <Box
          aria-hidden
          sx={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: 1.25,
            color: "primary.main",
            bgcolor: "background.paper",
          }}
        >
          {channel.icon}
        </Box>
        <ArrowOutwardRoundedIcon
          className="contact-arrow"
          sx={{
            color: "primary.main",
            fontSize: 20,
            transition: "transform 220ms ease",
          }}
        />
      </Stack>
      <Box sx={{ mt: 2.5, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 850 }}>{channel.channel}</Typography>
        <Typography variant="body2" sx={{ mt: 0.25, color: "text.secondary" }}>
          {channel.note}
        </Typography>
        <Typography sx={{ mt: 1, color: "primary.main", fontWeight: 700 }}>
          {channel.address}
        </Typography>
      </Box>
    </Paper>
  );
}

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
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(300px, 0.72fr) 1.28fr",
            },
            gap: { xs: 3, md: 4 },
            alignItems: "stretch",
          }}
        >
          <ContactPromoPanel signupUrl={signupUrl} />

          <Box component="section" aria-labelledby="contact-directory-title">
            <Typography
              variant="overline"
              sx={{
                color: "primary.main",
                fontWeight: 900,
                letterSpacing: "0.14em",
              }}
            >
              Contact directory
            </Typography>
            <Typography
              id="contact-directory-title"
              component="h2"
              sx={{
                mt: 1,
                fontFamily: "var(--font-display, inherit)",
                fontSize: { xs: "2rem", sm: "2.6rem" },
                fontWeight: 800,
                lineHeight: 1.06,
              }}
            >
              Pick the shortest route to an answer.
            </Typography>
            <Typography
              sx={{ mt: 1.5, mb: 3.5, maxWidth: 620, color: "text.secondary" }}
            >
              Choose the team closest to your question. Email opens in your mail
              app; WhatsApp starts a direct conversation.
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
              }}
            >
              {contactChannels.map((channel, index) => (
                <ContactChannelCard
                  key={channel.channel}
                  channel={channel}
                  emphasised={index < 2}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Section>
    </>
  );
}
