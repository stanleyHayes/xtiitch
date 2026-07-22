import type { MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  FaqList,
  PageHero,
  Section,
  SectionHeading,
} from "../components/ui";
import { faqs } from "../content";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "FAQ",
    description:
      "Answers on getting paid, pricing, deposits on custom orders, mobile money and cards, cash sales, order tracking, cancellations, and data safety.",
    path: "/faq",
  });
}

const faqHighlights = [
  {
    title: "Payments go straight to the business",
    body: "Xtiitch never runs a wallet or escrow balance.",
    Icon: AccountBalanceWalletRoundedIcon,
    color: "#237a4b",
  },
  {
    title: "Custom work starts with clear deposits",
    body: "Standard orders pay in full; custom orders can start with a deposit.",
    Icon: StraightenRoundedIcon,
    color: "#b87914",
  },
  {
    title: "Each store is isolated",
    body: "A business sees only its own customers, orders and money records.",
    Icon: VerifiedUserRoundedIcon,
    color: "#800020",
  },
];

export default function Faq() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Questions, answered plainly"
        subtitle="The things fashion businesses and their customers ask most. If something isn’t here, contact support and we’ll help."
      />

      <Section>
        <SectionHeading
          eyebrow="Quick answers"
          title="The three things most people want to know first"
          subtitle="The details are below, but these rules shape the whole platform."
        />
        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            mb: { xs: 5, md: 7 },
          }}
        >
          {faqHighlights.map((item, index) => (
            <Box
              key={item.title}
              sx={{
                position: "relative",
                p: 3,
                minHeight: 210,
                border: "1px solid",
                borderColor: index === 0 ? `${item.color}55` : "divider",
                borderRadius: 1,
                bgcolor: "rgba(var(--surface-rgb), 0.88)",
                overflow: "hidden",
                boxShadow:
                  index === 0
                    ? "0 28px 70px -54px rgba(35,122,75,0.72)"
                    : "0 22px 58px -50px rgba(21,17,26,0.45)",
                "&:before": {
                  content: '""',
                  position: "absolute",
                  inset: "0 0 auto 0",
                  height: 5,
                  bgcolor: item.color,
                },
              }}
            >
              <item.Icon
                aria-hidden
                sx={{
                  position: "absolute",
                  right: -18,
                  bottom: -18,
                  fontSize: 120,
                  color: `${item.color}14`,
                }}
              />
              <Box
                aria-hidden
                sx={{
                  width: 44,
                  height: 44,
                  mb: 2,
                  borderRadius: 1,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: `${item.color}12`,
                  color: item.color,
                  border: "1px solid",
                  borderColor: `${item.color}28`,
                }}
              >
                <item.Icon fontSize="small" />
              </Box>
              <Typography variant="h5" component="h2">
                {item.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, color: "text.secondary" }}
              >
                {item.body}
              </Typography>
            </Box>
          ))}
        </Box>
        <FaqList items={faqs} />
      </Section>

      <CtaBand
        title="Still have a question?"
        body="Start your store for free, add what you sell, and contact support whenever you need help."
      />
    </>
  );
}
