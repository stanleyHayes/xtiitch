import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Section, SectionHeading } from "../../components/ui";
import { site } from "../../content";

// Pre-launch (discover flag off) the home page must NOT list businesses — real
// or placeholder. Instead it explains, warmly, what being featured on Xtiitch
// will do for a fashion business once the directory goes live.
export function DiscoverFeaturedBlurb() {
  return (
    <Section alt>
      <Box sx={{ maxWidth: 760, mx: "auto", textAlign: "center" }}>
        <SectionHeading
          eyebrow="Featured on Xtiitch"
          title="Get discovered by new customers"
          subtitle="When the storefront directory opens, verified fashion businesses on Xtiitch will be featured here — putting your designs in front of customers who are looking for exactly what you make. Being featured helps people find your shop, browse your latest pieces, and order directly, so a new customer can discover you without ever knowing your name first."
        />
        <Button
          component="a"
          href={site.primaryCta.href}
          variant="contained"
          size="large"
          endIcon={<ArrowForwardRoundedIcon />}
        >
          {site.primaryCta.label}
        </Button>
      </Box>
    </Section>
  );
}
