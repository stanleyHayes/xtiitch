import type { MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
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

export default function Security() { // eslint-disable-line max-lines-per-function -- route action/loader with many conditional branches; refactor in follow-up
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
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, md: 4 },
            gridTemplateColumns: { xs: "1fr", md: "0.88fr 1.12fr" },
            alignItems: "stretch",
          }}
        >
          <Box
            sx={{
              position: "relative",
              minHeight: { xs: 320, md: "100%" },
              borderRadius: 1,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 30px 76px -54px rgba(21,17,26,0.62)",
            }}
          >
            <Box
              component="img"
              src="/images/security-settlement.webp"
              alt="Ghanaian fashion business owner confirming a secure digital settlement beside prepared orders"
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
                  "linear-gradient(180deg, rgba(21,17,26,0.08), rgba(21,17,26,0.82)), linear-gradient(90deg, rgba(128,0,32,0.28), rgba(21,17,26,0.08))",
              }}
            />
            <Box
              sx={{
                position: "relative",
                minHeight: { xs: 320, md: 520 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                p: { xs: 2.5, md: 3 },
                color: "common.white",
              }}
            >
              <Chip
                label="No wallet. No escrow."
                sx={{
                  alignSelf: "flex-start",
                  mb: 2,
                  color: "common.white",
                  bgcolor: "rgba(128,0,32,0.72)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              />
              <Typography variant="h3" component="h3">
                Xtiitch records the sale. Paystack moves the money.
              </Typography>
              <Typography sx={{ mt: 1.5, color: "rgba(255,255,255,0.76)" }}>
                That boundary keeps the product honest: order software on one
                side, regulated payment processing on the other.
              </Typography>
            </Box>
          </Box>

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
                  transition:
                    "transform 190ms ease, border-color 190ms ease, box-shadow 190ms ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    borderColor: "rgba(128,0,32,0.18)",
                    boxShadow: "0 24px 58px -52px rgba(21,17,26,0.52)",
                  },
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
                    bgcolor:
                      index === 0 ? "primary.main" : "rgba(128,0,32,0.08)",
                    color:
                      index === 0 ? "primary.contrastText" : "primary.main",
                    border: "1px solid",
                    borderColor:
                      index === 0 ? "primary.main" : "rgba(128,0,32,0.16)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                  }}
                >
                  {index + 1}
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 800,
                      display: "flex",
                      gap: 1,
                      alignItems: "center",
                    }}
                  >
                    {item.step}
                    {index === moneyFlow.length - 1 ? (
                      <CheckCircleRoundedIcon
                        fontSize="small"
                        sx={{ color: "success.main" }}
                        aria-hidden
                      />
                    ) : null}
                  </Typography>
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
        body="Create your store and start taking secure payments through your connected Paystack account."
        image="/images/cta-security.webp"
      />
    </>
  );
}
