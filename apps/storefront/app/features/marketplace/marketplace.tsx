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
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { PublicShop, SponsoredPlacement } from "../../lib/api";
import { DesignCard } from "./design-card";
import { EmptyState } from "./empty-state";
import { FeaturedCard } from "./featured-card";
import { StudioCard } from "./studio-card";
import type { FlatDesign, SortKey, Tab } from "./types";

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
            <Box
              component="img"
              src="/favicon.svg"
              alt="Xtiitch"
              sx={{ width: 34, height: 34, borderRadius: "9px", display: "block" }}
            />
            <Typography sx={{ fontWeight: 950, letterSpacing: 0.4 }}>Xtiitch</Typography>
            <Chip
              size="small"
              label="Marketplace"
              sx={{ ml: 0.5, bgcolor: alpha(tokens.white, 0.12), color: tokens.white, fontWeight: 800, letterSpacing: 0.4 }}
            />
            <Button
              component={RouterLink}
              to="/account"
              variant="outlined"
              size="small"
              startIcon={<AccountCircleRounded />}
              sx={{
                ml: "auto",
                color: tokens.white,
                borderColor: alpha(tokens.white, 0.4),
                fontWeight: 800,
                "&:hover": { borderColor: tokens.white, bgcolor: alpha(tokens.white, 0.08) },
              }}
            >
              Account
            </Button>
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
                    "& .MuiOutlinedInput-root": {
                      bgcolor: tokens.white,
                      borderRadius: "12px",
                      color: tokens.ink,
                      fontWeight: 600,
                    },
                    "& .MuiOutlinedInput-input::placeholder": {
                      color: alpha(tokens.ink, 0.55),
                      opacity: 1,
                    },
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
                    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: alpha(tokens.burgundy, 0.35),
                    },
                    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: tokens.burgundy,
                      borderWidth: 2,
                    },
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
              <Button href="https://xtiitch.com" target="_blank" rel="noopener noreferrer" variant="text" size="small" sx={{ color: alpha(tokens.white, 0.7) }}>
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
            <EmptyState
              icon={<StorefrontRounded sx={{ fontSize: 28 }} />}
              title={q ? `No studios match “${search.trim()}”` : "Studios are on their way"}
              hint={
                q
                  ? "Try a shorter or different name, or switch to Designs and describe what you’re after."
                  : "Verified studios appear here as they open their storefronts. Check back soon — new shops are joining."
              }
              action={
                q ? (
                  <Button onClick={() => setSearch("")} variant="contained" startIcon={<SearchRounded />}>
                    Clear search
                  </Button>
                ) : (
                  <Button component={RouterLink} to="/discover" variant="contained" startIcon={<AutoAwesomeRounded />}>
                    Try AI search
                  </Button>
                )
              }
            />
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
          <EmptyState
            title={q ? `No designs match “${search.trim()}”` : "Designs are on their way"}
            hint={
              q
                ? "Keyword match is strict. Describe the piece — fabric, occasion, budget — and AI search reads it across every shop."
                : "As studios add pieces they appear here. Or describe what you want and let AI search look across every shop."
            }
            action={
              <Button
                component={RouterLink}
                to={q ? `/discover?q=${encodeURIComponent(search.trim())}` : "/discover"}
                variant="contained"
                startIcon={<AutoAwesomeRounded />}
              >
                {q ? "Search with AI" : "Try AI search"}
              </Button>
            }
          />
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
