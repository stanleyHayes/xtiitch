import type { MetaDescriptor } from "react-router";
import { useLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { pageMeta } from "../components/seo";
import { PageHero, Section, SectionHeading } from "../components/ui";
import { ShopCard, SponsoredRail } from "../components/directory";
import { PaginatedGrid } from "../components/pagination";
import {
  loadPublicShops,
  marketplaceHref,
  type DirectoryShop,
} from "../lib/directory";
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
  marketplaceUrl: string;
}> {
  const [shops, sponsored] = await Promise.all([
    loadPublicShops(),
    loadSponsoredOrFeatured(3),
  ]);
  return {
    shops,
    sponsored: sponsored.filter((p) => p.placementType !== "promoted_design"),
    marketplaceUrl: marketplaceHref(),
  };
}

export default function Shops() {
  const { shops, sponsored, marketplaceUrl } = useLoaderData<typeof loader>();
  return (
    <>
      <PageHero
        eyebrow="Discover"
        title="Browse fashion shops on Xtiitch"
        subtitle="Every studio here runs a real, verified storefront. Open one to see what they make and order directly — no account needed to look around."
      />

      <Box
        sx={{
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            maxWidth: "lg",
            mx: "auto",
            px: { xs: 2, md: 3 },
            py: { xs: 2.5, md: 3 },
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Typography sx={{ color: "text.secondary", maxWidth: 560 }}>
            Want the full picture? The Xtiitch marketplace puts every studio,
            design, and AI search in one place.
          </Typography>
          <Button
            href={marketplaceUrl}
            variant="contained"
            size="large"
            startIcon={<StorefrontRoundedIcon />}
            sx={{ flexShrink: 0 }}
          >
            Open the marketplace
          </Button>
        </Box>
      </Box>

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
          <PaginatedGrid
            items={shops}
            label="studios"
            pageSize={9}
            gridSx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
              gap: 2.5,
            }}
            renderItem={(shop) => (
              <ShopCard key={shop.businessId} shop={shop} />
            )}
          />
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
