import type { MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  PageHero,
  Section,
  SectionHeading,
  TrustGrid,
} from "../components/ui";
import { trustPoints } from "../content";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Security and trust",
    description:
      "Payments settle directly to each business through Paystack. Xtiitch holds no funds, card details never touch the platform, and every business is sealed off from the rest.",
    path: "/security",
  });
}

const moneyFlow: { step: string; body: string }[] = [
  {
    step: "A customer pays",
    body: "At checkout or through a payment link, by mobile money or card, in Ghana Cedis.",
  },
  {
    step: "Paystack processes it",
    body: "Card details are handled on Paystack’s own secure surfaces. Raw card data never reaches Xtiitch.",
  },
  {
    step: "The money splits as it flows",
    body: "The business receives its share directly to its own account; Xtiitch’s small commission is split off automatically.",
  },
  {
    step: "Settlement goes straight to the business",
    body: "Funds settle to the business’s own settlement account. Xtiitch is never in the path of the money — no wallet, no escrow, no payout to chase.",
  },
];

export default function Security() {
  return (
    <>
      <PageHero
        eyebrow="Security and trust"
        title="We stand beside the money, never holding it"
        subtitle="Trust is the whole product. Here is exactly how payments, data and isolation work — stated plainly, with nothing hidden."
      />

      <Section>
        <TrustGrid items={trustPoints} />
      </Section>

      <Section alt>
        <SectionHeading
          eyebrow="The money flow"
          title="Where your money goes, step by step"
          subtitle="Because we never take custody of anyone’s funds, Xtiitch stays clean and scalable — and you stay in control of your earnings."
        />
        <Box sx={{ maxWidth: 940, mx: "auto" }}>
          <Stack spacing={0}>
            {moneyFlow.map((item, index) => (
              <Box
                key={item.step}
                sx={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 2,
                  p: { xs: 2, md: 2.5 },
                  border: "1px solid",
                  borderColor: "divider",
                  borderBottomWidth: index === moneyFlow.length - 1 ? 1 : 0,
                  bgcolor:
                    index % 2 === 0 ? "background.paper" : "background.default",
                  "&:first-of-type": {
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                  },
                  "&:last-of-type": {
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                  },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    flexShrink: 0,
                    width: 42,
                    height: 42,
                    borderRadius: 1,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                  }}
                >
                  {index + 1}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{item.step}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {item.body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Section>

      <CtaBand
        title="Payments you and your customers can trust"
        body="Join the waitlist and start taking secure payments straight to your own account."
      />
    </>
  );
}
