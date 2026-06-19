import type { MetaDescriptor } from "react-router";
import { Link as RouterLink, useLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { pageMeta } from "../components/seo";
import { CtaBand, PageHero, Section, SectionHeading } from "../components/ui";
import { DesignCard, ShopCard, SponsoredRail } from "../components/directory";
import {
  flattenDesigns,
  loadPublicShops,
  type DirectoryDesign,
  type DirectoryShop,
} from "../lib/directory";
import {
  loadSponsoredOrFeatured,
  type SponsoredPlacement,
} from "../lib/sponsored";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Discover — Xtiitch",
    description:
      "Discover fashion shops and designs from verified Ghanaian studios running on Xtiitch.",
    path: "/discover",
  });
}

export async function loader(): Promise<{
  shops: DirectoryShop[];
  designs: DirectoryDesign[];
  sponsored: SponsoredPlacement[];
}> {
  const [shops, sponsored] = await Promise.all([
    loadPublicShops(),
    loadSponsoredOrFeatured(4),
  ]);
  return { shops, designs: flattenDesigns(shops), sponsored };
}

function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <Box sx={{ mt: 3, textAlign: "center" }}>
      <Button
        component={RouterLink}
        to={to}
        variant="outlined"
        endIcon={<ArrowForwardRoundedIcon />}
      >
        {label}
      </Button>
    </Box>
  );
}

export default function Discover() {
  const { shops, designs, sponsored } = useLoaderData<typeof loader>();
  const shopPreview = shops.slice(0, 3);
  const designPreview = designs.slice(0, 8);

  return (
    <>
      <PageHero
        eyebrow="Discover"
        title="Shops and designs from Ghanaian studios"
        subtitle="Every studio here runs a verified storefront on Xtiitch. Browse the shops, find a piece you like, and order it directly from the business that makes it."
      />

      {sponsored.length > 0 ? (
        <Section alt>
          <SectionHeading
            align="left"
            eyebrow="Sponsored"
            title="Featured on Xtiitch"
            subtitle="Paid placements from verified businesses — clearly labelled, always a real storefront."
          />
          <SponsoredRail placements={sponsored} />
        </Section>
      ) : null}

      {shopPreview.length > 0 ? (
        <Section>
          <SectionHeading
            align="left"
            eyebrow="Shops"
            title="Studios open for business"
            subtitle="A few of the verified studios running their storefronts on Xtiitch."
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
              gap: 2.5,
            }}
          >
            {shopPreview.map((shop) => (
              <ShopCard key={shop.businessId} shop={shop} />
            ))}
          </Box>
          <SeeAll to="/shops" label="Browse all shops" />
        </Section>
      ) : null}

      {designPreview.length > 0 ? (
        <Section alt>
          <SectionHeading
            align="left"
            eyebrow="Designs"
            title="Pieces to browse right now"
            subtitle="A sample of what studios are making. Open one to see pricing and order options."
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                sm: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: { xs: 1.5, md: 2.5 },
            }}
          >
            {designPreview.map((design) => (
              <DesignCard
                key={`${design.shopHandle}-${design.handle}`}
                design={design}
              />
            ))}
          </Box>
          <SeeAll to="/designs" label="Browse all designs" />
        </Section>
      ) : null}

      <CtaBand
        title="Run a fashion business? Get listed."
        body="Open a verified storefront on Xtiitch and your shop appears here automatically. Join the waitlist to get set up."
      />
    </>
  );
}
