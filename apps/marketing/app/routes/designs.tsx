import type { MetaDescriptor } from "react-router";
import { useLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { pageMeta } from "../components/seo";
import { PageHero, Section, SectionHeading } from "../components/ui";
import { DesignCard, SponsoredRail } from "../components/directory";
import { PaginatedGrid } from "../components/pagination";
import {
  flattenDesigns,
  loadPublicShops,
  type DirectoryDesign,
} from "../lib/directory";
import {
  loadSponsoredOrFeatured,
  type SponsoredPlacement,
} from "../lib/sponsored";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Browse designs — Xtiitch",
    description:
      "Browse pieces from verified fashion studios on Xtiitch and order the ones you like directly from the business.",
    path: "/designs",
  });
}

export async function loader(): Promise<{
  designs: DirectoryDesign[];
  sponsored: SponsoredPlacement[];
}> {
  const [shops, sponsored] = await Promise.all([
    loadPublicShops(),
    loadSponsoredOrFeatured(3),
  ]);
  return {
    designs: flattenDesigns(shops),
    sponsored: sponsored.filter((p) => p.placementType === "promoted_design"),
  };
}

export default function Designs() {
  const { designs, sponsored } = useLoaderData<typeof loader>();
  return (
    <>
      <PageHero
        eyebrow="Discover"
        title="Browse designs from Ghanaian studios"
        subtitle="Pieces from verified businesses across Xtiitch. Find something you like and order it straight from the studio that makes it."
      />

      {sponsored.length > 0 ? (
        <Section alt>
          <SectionHeading
            align="left"
            eyebrow="Sponsored"
            title="Promoted designs"
            subtitle="Paid placements from verified businesses, clearly labelled."
          />
          <SponsoredRail placements={sponsored} />
        </Section>
      ) : null}

      <Section>
        <SectionHeading
          align="left"
          eyebrow="All designs"
          title={
            designs.length === 1 ? "1 piece" : `${designs.length} pieces to browse`
          }
          subtitle="A sample of what studios are making now. Open one to see full pricing and order options."
        />
        {designs.length > 0 ? (
          <PaginatedGrid
            items={designs}
            label="designs"
            pageSize={12}
            gridSx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                sm: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: { xs: 1.5, md: 2.5 },
            }}
            renderItem={(design) => (
              <DesignCard
                key={`${design.shopHandle}-${design.handle}`}
                design={design}
              />
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
              Designs are coming soon
            </Typography>
            <Typography sx={{ mt: 1, color: "text.secondary" }}>
              Pieces will appear here as verified studios publish their work.
            </Typography>
          </Box>
        )}
      </Section>
    </>
  );
}
