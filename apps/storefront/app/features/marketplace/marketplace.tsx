import { useMemo, useState } from "react";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import FilterListRounded from "@mui/icons-material/FilterListRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Container from "@mui/material/Container";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router";
import TextField from "../../components/form-text-field";
import type { PublicShop, SponsoredPlacement } from "../../lib/api";
import { tokens } from "../../theme";
import { DesignCard } from "./design-card";
import { EmptyState } from "./empty-state";
import { MarketplaceHeader } from "./marketplace-header";
import { MarketplaceHero } from "./marketplace-hero";
import { StudioCard } from "./studio-card";
import { StyleRail } from "./style-rail";
import type { FlatDesign, SortKey, Tab } from "./types";

const catalogueFilters = [
  { label: "Contemporary", query: "contemporary" },
  { label: "Heritage & print", query: "kente print heritage adire" },
  { label: "Bridal", query: "bridal wedding bride" },
  { label: "Menswear", query: "men menswear shirt kaftan" },
  { label: "Ready to wear", query: "ready casual everyday" },
] as const;

function shopSearchText(shop: PublicShop): string {
  return [shop.name, ...shop.designs.map((design) => design.title)]
    .join(" ")
    .toLowerCase();
}

function matchesCatalogueFilter(shop: PublicShop, filter: string): boolean {
  if (!filter) return true;
  const config = catalogueFilters.find((item) => item.label === filter);
  if (!config) return true;
  const text = shopSearchText(shop);
  return config.query.split(" ").some((keyword) => text.includes(keyword));
}

// eslint-disable-next-line max-lines-per-function -- selected marketplace screen keeps filters, tabs and results coordinated
export function Marketplace({
  shops,
  sponsored,
}: {
  shops: PublicShop[];
  sponsored: SponsoredPlacement[];
}) {
  const [tab, setTab] = useState<Tab>("studios");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");
  const [catalogueFilter, setCatalogueFilter] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const designs: FlatDesign[] = useMemo(
    () =>
      shops.flatMap((shop) =>
        shop.designs.map((design) => ({
          ...design,
          store_name: shop.name,
          store_handle: shop.handle,
          brand_color: shop.brand_color,
        })),
      ),
    [shops],
  );

  const promotedHandles = useMemo(
    () =>
      new Set(
        sponsored.map(
          (placement) => placement.store_handle || placement.business_handle,
        ),
      ),
    [sponsored],
  );
  const q = search.trim().toLowerCase();

  const visibleStudios = useMemo(() => {
    let list = shops.filter((shop) =>
      matchesCatalogueFilter(shop, catalogueFilter),
    );
    if (q) list = list.filter((shop) => shopSearchText(shop).includes(q));
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else {
      sorted.sort((a, b) => {
        const promoted =
          Number(promotedHandles.has(b.handle)) -
          Number(promotedHandles.has(a.handle));
        return promoted || b.design_count - a.design_count;
      });
    }
    return sorted;
  }, [catalogueFilter, promotedHandles, q, shops, sort]);

  const visibleDesigns = useMemo(() => {
    let list = designs;
    const filterConfig = catalogueFilters.find(
      (item) => item.label === catalogueFilter,
    );
    if (filterConfig) {
      const keywords = filterConfig.query.split(" ");
      list = list.filter((design) =>
        keywords.some((keyword) =>
          design.title.toLowerCase().includes(keyword),
        ),
      );
    }
    if (q)
      list = list.filter((design) =>
        `${design.title} ${design.store_name}`.toLowerCase().includes(q),
      );
    const sorted = [...list];
    if (sort === "price_low")
      sorted.sort((a, b) => a.price_minor - b.price_minor);
    else if (sort === "price_high")
      sorted.sort((a, b) => b.price_minor - a.price_minor);
    else if (sort === "name")
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [catalogueFilter, designs, q, sort]);

  const clearFilters = () => {
    setSearch("");
    setCatalogueFilter("");
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <MarketplaceHeader />
      <MarketplaceHero />
      <StyleRail designs={designs} />

      <Container maxWidth="xl" component="main" sx={{ py: { xs: 3, md: 4 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "190px minmax(0, 1fr)" },
            gap: { xs: 2, lg: 3 },
          }}
        >
          <Box component="aside">
            <Button
              variant="outlined"
              startIcon={<FilterListRounded />}
              onClick={() => setShowMobileFilters((open) => !open)}
              aria-expanded={showMobileFilters}
              sx={{ display: { xs: "inline-flex", lg: "none" }, mb: 1 }}
            >
              Filter styles
            </Button>
            <Box
              sx={{
                display: {
                  xs: showMobileFilters ? "block" : "none",
                  lg: "block",
                },
                borderRight: { lg: "1px solid" },
                borderColor: { lg: "divider" },
                pr: { lg: 2.5 },
                pb: { xs: 1.5, lg: 0 },
              }}
            >
              <Typography
                variant="overline"
                sx={{
                  color: tokens.burgundy,
                  fontWeight: 900,
                  letterSpacing: "0.1em",
                }}
              >
                Discover studios
              </Typography>
              <Typography sx={{ mt: 1.6, mb: 0.75, fontWeight: 850 }}>
                Style & occasion
              </Typography>
              <Stack>
                {catalogueFilters.map((filter) => (
                  <FormControlLabel
                    key={filter.label}
                    label={filter.label}
                    control={
                      <Checkbox
                        size="small"
                        checked={catalogueFilter === filter.label}
                        onChange={() =>
                          setCatalogueFilter((current) =>
                            current === filter.label ? "" : filter.label,
                          )
                        }
                      />
                    }
                    sx={{
                      m: 0,
                      minHeight: 34,
                      "& .MuiFormControlLabel-label": {
                        fontSize: 14,
                        color: "text.secondary",
                      },
                    }}
                  />
                ))}
              </Stack>
              {catalogueFilter || q ? (
                <Button
                  onClick={clearFilters}
                  size="small"
                  sx={{ mt: 1, px: 0 }}
                >
                  Clear filters
                </Button>
              ) : null}
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 2,
                  color: "text.secondary",
                  lineHeight: 1.5,
                }}
              >
                Filters read each studio&apos;s live catalogue. More discovery
                options appear as studios add pieces.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.25}
              sx={{
                alignItems: { md: "center" },
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  width: "fit-content",
                  p: 0.4,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 999,
                  bgcolor: "background.paper",
                }}
              >
                {(["studios", "designs"] as const).map((item) => (
                  <Button
                    key={item}
                    size="small"
                    variant={tab === item ? "contained" : "text"}
                    onClick={() => setTab(item)}
                    sx={{ px: 2.4, minHeight: 36, textTransform: "capitalize" }}
                  >
                    {item}
                  </Button>
                ))}
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                sx={{
                  width: { xs: "100%", md: "auto" },
                  flex: { md: 1 },
                  maxWidth: { md: 520 },
                }}
              >
                <TextField
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={
                    tab === "studios"
                      ? "Search studios or styles"
                      : "Search designs"
                  }
                  size="small"
                  fullWidth
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRounded fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  size="small"
                  aria-label="Sort marketplace results"
                  sx={{
                    minWidth: { xs: 128, sm: 150 },
                    bgcolor: "background.paper",
                  }}
                >
                  <MenuItem value="popular">Most popular</MenuItem>
                  <MenuItem value="name">Name (A–Z)</MenuItem>
                  {tab === "designs" ? (
                    <MenuItem value="price_low">Price: low to high</MenuItem>
                  ) : null}
                  {tab === "designs" ? (
                    <MenuItem value="price_high">Price: high to low</MenuItem>
                  ) : null}
                </Select>
              </Stack>
            </Stack>

            {tab === "studios" ? (
              visibleStudios.length === 0 ? (
                <EmptyState
                  icon={<StorefrontRounded sx={{ fontSize: 32 }} />}
                  title="No studios match those filters"
                  hint="Clear a filter or search another style. You can also describe the exact piece you want and let AI search every catalogue."
                  action={
                    <Button onClick={clearFilters} variant="contained">
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      md: "repeat(2, minmax(0, 1fr))",
                      xl: "1.08fr .92fr .92fr",
                    },
                    gridAutoRows: { md: 224 },
                    gap: 1.5,
                    "& > :first-of-type": {
                      gridRow: { md: "span 2" },
                      gridColumn: { sm: "span 2", xl: "span 1" },
                    },
                  }}
                >
                  {visibleStudios.map((shop, index) => (
                    <StudioCard
                      key={shop.handle}
                      shop={shop}
                      featured={index === 0}
                      promoted={promotedHandles.has(shop.handle)}
                    />
                  ))}
                </Box>
              )
            ) : visibleDesigns.length === 0 ? (
              <EmptyState
                title="No designs match those filters"
                hint="Try a broader style or ask the AI stylist to search across every studio."
                action={
                  <Button
                    component={RouterLink}
                    to={
                      q
                        ? `/discover?q=${encodeURIComponent(search.trim())}`
                        : "/discover"
                    }
                    variant="contained"
                    startIcon={<AutoAwesomeRounded />}
                  >
                    Search with AI
                  </Button>
                }
              />
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(3, minmax(0, 1fr))",
                    xl: "repeat(4, minmax(0, 1fr))",
                  },
                }}
              >
                {visibleDesigns.map((design) => (
                  <DesignCard
                    key={`${design.store_handle}-${design.handle}`}
                    d={design}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
