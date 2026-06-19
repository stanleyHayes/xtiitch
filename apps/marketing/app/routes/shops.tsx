import type { MetaDescriptor } from "react-router";
import { useLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { pageMeta } from "../components/seo";
import { PageHero, Section, SectionHeading } from "../components/ui";
import { ShopCard, SponsoredRail } from "../components/directory";
import { loadPublicShops, type DirectoryShop } from "../lib/directory";
import {
  loadSponsoredOrFeatured,
  type SponsoredPlacement,
} from "../lib/sponsored";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Browse shops — Xtiitch",
    description:
      "Discover verified fashion businesses running their storefronts on Xtiitch and visit their stores directly.",
    path: "/shops",
  });
}

export async function loader(): Promise<{
  shops: DirectoryShop[];
  sponsored: SponsoredPlacement[];
}> {
  const [shops, sponsored] = await Promise.all([
    loadPublicShops(),
    loadSponsoredOrFeatured(3),
  ]);
  return {
    shops,
    sponsored: sponsored.filter((p) => p.placementType !== "promoted_design"),
  };
}

export default function Shops() {
  const { shops, sponsored } = useLoaderData<typeof loader>();
  return (
    <>
      <PageHero
        eyebrow="Discover"
        title="Browse fashion shops on Xtiitch"
        subtitle="Every studio here runs a real, verified storefront. Open one to see what they make and order directly — no account needed to look around."
      />

      {sponsored.length > 0 ? (
        <Section alt>
          <SectionHeading
            align="left"
            eyebrow="Sponsored"
            title="Featured studios"
            subtitle="Paid placements from verified businesses. Clearly labelled, and always a real storefront."
          />
          <SponsoredRail placements={sponsored} />
        </Section>
      ) : null}

      <Section>
        <SectionHeading
          align="left"
          eyebrow="All shops"
          title={
            shops.length === 1
              ? "1 verified studio"
              : `${shops.length} verified studios`
          }
          subtitle="Listed automatically once a business is verified and active. Tap through to browse and order."
        />
        {shops.length > 0 ? (
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
            {shops.map((shop) => (
              <ShopCard key={shop.businessId} shop={shop} />
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: 1,
              border: "1px dashed",
              borderColor: "divider",
              textAlign: "center",
              bgcolor: "background.paper",
            }}
          >
            <Typography variant="h5" component="p">
              Studios are coming soon
            </Typography>
            <Typography sx={{ mt: 1, color: "text.secondary" }}>
              Verified businesses will appear here as they open their storefronts.
            </Typography>
          </Box>
        )}
      </Section>
    </>
  );
}
