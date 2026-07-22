import type { MetaDescriptor } from "react-router";
import { useRouteLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import { pageMeta } from "../components/seo";
import { PageHero, Section } from "../components/ui";
import { site } from "../content";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Contact Xtiitch",
    description:
      "Create your Xtiitch store or contact the support team for account, payment, privacy and product help.",
    path: "/contact",
  });
}

const contactOptions = [
  {
    title: "Create your store",
    body: "Registration is open. Start on the Free plan, publish your storefront and upgrade whenever the added tools make sense.",
    action: "Start for free",
    href: "signup",
    icon: <StorefrontRoundedIcon />,
  },
  {
    title: "Get product support",
    body: "Ask about setup, billing, orders, payments or your storefront. Include your business name and payment reference when relevant.",
    action: "Email support",
    href: "mailto:support@xtiitch.com",
    icon: <SupportAgentRoundedIcon />,
  },
  {
    title: "Privacy and legal requests",
    body: "Use the same support address for privacy rights, policy questions, account closure or a formal complaint.",
    action: "Contact the team",
    href: "mailto:support@xtiitch.com",
    icon: <MailRoundedIcon />,
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
        subtitle="Self-serve registration is open, and the Xtiitch team is available when you need help with the product, payments or your information."
      />
      <Section>
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          }}
        >
          {contactOptions.map((option) => {
            const href = option.href === "signup" ? signupUrl : option.href;
            return (
              <Paper
                key={option.title}
                elevation={0}
                sx={{
                  p: { xs: 3, md: 3.5 },
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "rgba(var(--surface-rgb), 0.9)",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 300,
                }}
              >
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
                  }}
                >
                  {option.icon}
                </Box>
                <Typography variant="h5" component="h2" sx={{ mt: 2.5 }}>
                  {option.title}
                </Typography>
                <Typography sx={{ mt: 1.25, color: "text.secondary" }}>
                  {option.body}
                </Typography>
                <Stack sx={{ mt: "auto", pt: 3 }}>
                  <Button
                    component="a"
                    href={href}
                    variant={option.href === "signup" ? "contained" : "outlined"}
                    endIcon={<ArrowForwardRoundedIcon />}
                  >
                    {option.action}
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      </Section>
    </>
  );
}
