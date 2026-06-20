import { useMemo, useState } from "react";
import { Form, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TextField from "./form-text-field";
import { formatGHS } from "../lib/format";
import type { PublicShop, SponsoredPlacement } from "../lib/api";
import { tokens } from "../theme";

type Tab = "studios" | "designs";
type SortKey = "popular" | "name" | "price_low" | "price_high";

type FlatDesign = {
  title: string;
  handle: string;
  image: string;
  price_minor: number;
  store_name: string;
  store_handle: string;
  brand_color: string;
};

function storeHref(handle: string) {
  return `/store/${encodeURIComponent(handle)}`;
}

// ── Featured (sponsored) ─────────────────────────────────────────────────────
function FeaturedCard({ p }: { p: SponsoredPlacement }) {
  return (
    <Box
      component={RouterLink}
      to={storeHref(p.store_handle || p.business_handle)}
      sx={{
        position: "relative",
        display: "block",
        textDecoration: "none",
        color: tokens.white,
        minWidth: { xs: 260, sm: 300 },
        flex: "0 0 auto",
        height: 200,
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: alpha(tokens.gold, 0.4),
        backgroundImage: p.image_url
          ? `linear-gradient(180deg, ${alpha(tokens.ink, 0.1)}, ${alpha(tokens.ink, 0.86)}), url(${p.image_url})`
          : `linear-gradient(135deg, ${tokens.wine}, ${tokens.ink})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "transform .2s ease, box-shadow .2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 22px 60px ${alpha(tokens.ink, 0.3)}`,
        },
      }}
    >
      <Chip
        size="small"
        icon={<BoltRounded sx={{ fontSize: 14, color: `${tokens.ink} !important` }} />}
        label="Featured"
        sx={{
          position: "absolute",
          top: 12,
          left: 12,
          fontWeight: 950,
          letterSpacing: 0.3,
          bgcolor: tokens.gold,
          color: tokens.ink,
          "& .MuiChip-label": { px: 0.75 },
        }}
      />
      <Box sx={{ position: "absolute", inset: 0, p: 1.75, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {p.business_name}
        </Typography>
        <Typography sx={{ fontWeight: 950, lineHeight: 1.15, fontSize: 18 }} noWrap>
          {p.headline || p.target_label || "Discover the collection"}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Studio card ──────────────────────────────────────────────────────────────
function StudioCard({ shop }: { shop: PublicShop }) {
  const accent = shop.brand_color || tokens.burgundy;
  return (
    <Box
      component={RouterLink}
      to={storeHref(shop.handle)}
      sx={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        bgcolor: "rgba(var(--surface-rgb), 0.92)",
        transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: `0 20px 50px ${alpha(tokens.ink, 0.14)}`,
          borderColor: alpha(accent, 0.45),
        },
      }}
    >
      <Box
        sx={{
          height: 96,
          backgroundImage: shop.banner_url
            ? `url(${shop.banner_url})`
            : `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.55)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <Box sx={{ p: 1.75, pt: 1.25 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: -3.5, mb: 1 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "10px",
              display: "grid",
              placeItems: "center",
              bgcolor: accent,
              color: tokens.white,
              fontWeight: 950,
              border: "2px solid rgb(var(--surface-rgb))",
              flexShrink: 0,
            }}
          >
            {shop.name.trim().charAt(0).toUpperCase()}
          </Box>
        </Stack>
        <Typography sx={{ fontWeight: 950, lineHeight: 1.2 }} noWrap>
          {shop.name}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.25 }}>
          {shop.design_count} {shop.design_count === 1 ? "design" : "designs"}
        </Typography>
        <Stack direction="row" spacing={0.75}>
          {shop.designs.slice(0, 3).map((d) => (
            <Box
              key={d.handle}
              sx={{
                flex: 1,
                aspectRatio: "1 / 1",
                borderRadius: "8px",
                bgcolor: alpha(tokens.ink, 0.05),
                backgroundImage: d.image ? `url(${d.image})` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ))}
          {shop.designs.length === 0 &&
            [0, 1, 2].map((i) => (
              <Box key={i} sx={{ flex: 1, aspectRatio: "1 / 1", borderRadius: "8px", bgcolor: alpha(tokens.ink, 0.05) }} />
            ))}
        </Stack>
      </Box>
    </Box>
  );
}

// ── Design card ──────────────────────────────────────────────────────────────
function DesignCard({ d }: { d: FlatDesign }) {
  return (
    <Box
      component={RouterLink}
      to={storeHref(d.store_handle)}
      sx={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        bgcolor: "rgba(var(--surface-rgb), 0.92)",
        transition: "transform .18s ease, box-shadow .18s ease",
        "&:hover": { transform: "translateY(-3px)", boxShadow: `0 20px 50px ${alpha(tokens.ink, 0.14)}` },
      }}
    >
      <Box
        sx={{
          aspectRatio: "4 / 5",
          bgcolor: alpha(tokens.ink, 0.05),
          backgroundImage: d.image ? `url(${d.image})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "grid",
          placeItems: "center",
        }}
      >
        {!d.image && <StorefrontRounded sx={{ color: alpha(tokens.ink, 0.25), fontSize: 40 }} />}
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }} noWrap>
          {d.title}
        </Typography>
        <Stack direction="row" sx={{ mt: 0.5, justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
            {d.store_name}
          </Typography>
          <Typography sx={{ fontWeight: 900, color: tokens.burgundy, flexShrink: 0 }}>
            {formatGHS(d.price_minor)}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

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

  const designs: FlatDesign[] = useMemo(
    () =>
      shops.flatMap((s) =>
        s.designs.map((d) => ({
          ...d,
          store_name: s.name,
          store_handle: s.handle,
          brand_color: s.brand_color,
        })),
      ),
    [shops],
  );

  const q = search.trim().toLowerCase();

  const visibleStudios = useMemo(() => {
    let list = shops;
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => b.design_count - a.design_count); // popular default
    return sorted;
  }, [shops, q, sort]);

  const visibleDesigns = useMemo(() => {
    let list = designs;
    if (q) list = list.filter((d) => d.title.toLowerCase().includes(q) || d.store_name.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === "price_low") sorted.sort((a, b) => a.price_minor - b.price_minor);
    else if (sort === "price_high") sorted.sort((a, b) => b.price_minor - a.price_minor);
    else if (sort === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [designs, q, sort]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.04)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.04)} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
    >
      {/* Hero */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          color: tokens.white,
          backgroundImage: `radial-gradient(circle at 12% 18%, ${alpha(tokens.burgundy, 0.55)}, transparent 42%), radial-gradient(circle at 88% 8%, ${alpha(tokens.gold, 0.22)}, transparent 38%), linear-gradient(160deg, ${tokens.ink}, ${tokens.charcoal})`,
        }}
      >
        <Container sx={{ py: { xs: 6, md: 9 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: "9px", bgcolor: tokens.burgundy, display: "grid", placeItems: "center" }}>
              <StorefrontRounded sx={{ fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontWeight: 950, letterSpacing: 0.4 }}>Xtiitch</Typography>
            <Chip
              size="small"
              label="Marketplace"
              sx={{ ml: 0.5, bgcolor: alpha(tokens.white, 0.12), color: tokens.white, fontWeight: 800, letterSpacing: 0.4 }}
            />
          </Stack>
          <Typography
            variant="h1"
            sx={{ fontSize: { xs: "2.6rem", md: "4.4rem" }, lineHeight: 1.02, maxWidth: 820, color: tokens.white }}
          >
            Ghana's fashion studios, in one place.
          </Typography>
          <Typography sx={{ mt: 2, fontSize: { xs: 16, md: 19 }, color: alpha(tokens.white, 0.82), maxWidth: 620 }}>
            Browse studios and their designs, or describe what you want and let AI
            find it across every shop — no account needed to look.
          </Typography>

          {/* AI search */}
          <Box sx={{ mt: 4, maxWidth: 680 }}>
            <Form method="get" action="/discover">
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <TextField
                  name="q"
                  placeholder="red kente dress for a wedding under 800"
                  aria-label="Describe what you want"
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": { bgcolor: alpha(tokens.white, 0.96), borderRadius: "12px" },
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <AutoAwesomeRounded fontSize="small" sx={{ color: tokens.burgundy }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button type="submit" variant="contained" size="large" endIcon={<ArrowForwardRounded />} sx={{ flexShrink: 0, px: 3 }}>
                  AI search
                </Button>
              </Stack>
            </Form>
            <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: "center" }}>
              <Button
                component={RouterLink}
                to="/track"
                variant="text"
                size="small"
                startIcon={<LocalShippingRounded />}
                sx={{ color: alpha(tokens.white, 0.85), "&:hover": { color: tokens.white, bgcolor: alpha(tokens.white, 0.08) } }}
              >
                Track an order
              </Button>
              <Button href="https://xtiitch.com" variant="text" size="small" sx={{ color: alpha(tokens.white, 0.7) }}>
                Learn about Xtiitch
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      <Container sx={{ py: { xs: 4, md: 6 } }}>
        {/* Featured / sponsored */}
        {sponsored.length > 0 && (
          <Box sx={{ mb: 5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
              <BoltRounded sx={{ color: tokens.gold }} />
              <Typography variant="h5" component="h2">
                Featured
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} sx={{ overflowX: "auto", pb: 1, "&::-webkit-scrollbar": { height: 6 } }}>
              {sponsored.map((p) => (
                <FeaturedCard key={p.campaign_id} p={p} />
              ))}
            </Stack>
          </Box>
        )}

        {/* Browse: filter bar */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{ alignItems: { md: "center" }, justifyContent: "space-between", mb: 2.5 }}
        >
          <Stack direction="row" spacing={0.5} sx={{ p: 0.5, borderRadius: 999, border: "1px solid", borderColor: alpha(tokens.ink, 0.12), bgcolor: "rgba(var(--surface-rgb), 0.6)", width: "fit-content" }}>
            {(["studios", "designs"] as const).map((t) => (
              <Button
                key={t}
                onClick={() => setTab(t)}
                variant={tab === t ? "contained" : "text"}
                size="small"
                sx={{
                  borderRadius: 999,
                  px: 2,
                  fontWeight: 900,
                  textTransform: "capitalize",
                  ...(tab !== t && { color: "text.secondary" }),
                }}
              >
                {t}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={1.25} sx={{ flex: 1, maxWidth: { md: 520 }, width: "100%" }}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "studios" ? "Search studios" : "Search designs"}
              fullWidth
              size="small"
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
              onChange={(e) => setSort(e.target.value as SortKey)}
              size="small"
              sx={{ minWidth: 150, borderRadius: "8px", bgcolor: "rgba(var(--surface-rgb), 0.92)" }}
            >
              <MenuItem value="popular">{tab === "studios" ? "Most designs" : "Featured"}</MenuItem>
              <MenuItem value="name">Name (A–Z)</MenuItem>
              {tab === "designs" && <MenuItem value="price_low">Price: low → high</MenuItem>}
              {tab === "designs" && <MenuItem value="price_high">Price: high → low</MenuItem>}
            </Select>
          </Stack>
        </Stack>

        {/* Grid */}
        {tab === "studios" ? (
          visibleStudios.length === 0 ? (
            <EmptyState label="No studios match that search." />
          ) : (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(3, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" },
              }}
            >
              {visibleStudios.map((s) => (
                <StudioCard key={s.handle} shop={s} />
              ))}
            </Box>
          )
        ) : visibleDesigns.length === 0 ? (
          <EmptyState label="No designs match that search — try AI search for a description." />
        ) : (
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(3, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" },
            }}
          >
            {visibleDesigns.map((d) => (
              <DesignCard key={`${d.store_handle}-${d.handle}`} d={d} />
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Box sx={{ textAlign: "center", py: 8 }}>
      <StorefrontRounded sx={{ fontSize: 44, color: alpha(tokens.ink, 0.25) }} />
      <Typography sx={{ mt: 1, color: "text.secondary" }}>{label}</Typography>
    </Box>
  );
}
