import { Form, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import type { Route } from "./+types/discover";
import TextField from "../components/form-text-field";
import { ResultCard } from "../features/discover/result-card";
import { formatGHS } from "../lib/format";
import { aiSearch, type AiQuota, type AiSearchResponse } from "../lib/discovery";
import { getSession } from "../lib/session";
import { requestTenant } from "../lib/tenant";
import { tokens } from "../theme";

const SEARCH_LIMIT = 16;

export function meta() {
  return [
    { title: "Discover · AI search · Xtiitch" },
    {
      name: "description",
      content:
        "Describe what you want in plain words — \"red kente dress for a wedding under 800\" — and Xtiitch finds it across every shop.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  // §5.4/§6: AI Search is cross-store by nature, so it must not exist at all
  // on a tenant store — the page 404s there before any search can run.
  if (requestTenant(request)) {
    throw new Response("Not found", { status: 404 });
  }
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("customerToken");
  const signedInPhone = session.get("customerPhone") ?? null;

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();

  let search: AiSearchResponse | null = null;
  if (query) {
    search = await aiSearch(query, SEARCH_LIMIT, token);
  }
  return { query, signedIn: Boolean(signedInPhone), search };
}

const EXAMPLES = [
  "flowy red kente dress for a wedding under 800",
  "agbada for a traditional engagement",
  "office-ready ankara blazer",
  "beaded gown for a dinner",
];

function QuotaMeter({ quota, signedIn }: { quota: AiQuota; signedIn: boolean }) {
  if (quota.unlimited) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: tokens.gold }}>
        <WorkspacePremiumRounded fontSize="small" />
        <Typography sx={{ fontWeight: 800 }}>Pro · unlimited searches</Typography>
      </Stack>
    );
  }
  const used = Math.min(quota.used, quota.limit);
  const pct = quota.limit > 0 ? (used / quota.limit) * 100 : 0;
  const remaining = Math.max(quota.remaining, 0);
  return (
    <Box sx={{ maxWidth: 360 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 800, color: "text.secondary" }}>
          {remaining} of {quota.limit} free searches left
        </Typography>
        {!signedIn && (
          <Typography
            component={RouterLink}
            to="/account?redirectTo=/discover"
            variant="caption"
            sx={{ fontWeight: 900, color: tokens.burgundy, textDecoration: "none" }}
          >
            Sign in for more
          </Typography>
        )}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 999,
          bgcolor: alpha(tokens.ink, 0.08),
          "& .MuiLinearProgress-bar": { bgcolor: tokens.burgundy },
        }}
      />
    </Box>
  );
}

function UpgradePrompt({ signedIn }: { signedIn: boolean }) {
  return (
    <Box
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: "8px",
        border: "1px solid",
        borderColor: alpha(tokens.gold, 0.5),
        bgcolor: alpha(tokens.gold, 0.07),
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <BoltRounded sx={{ color: tokens.gold }} />
        <Typography variant="h6" component="h2">
          You're out of free searches this month
        </Typography>
      </Stack>
      <Typography sx={{ mt: 1, color: "text.secondary" }}>
        {signedIn
          ? "You've used all your free AI searches for the month. Pro (unlimited) is coming soon — for now your allowance resets next month."
          : "Sign in with your phone to get 25 free searches a month — and unlimited with Pro, coming soon."}
      </Typography>
      {!signedIn && (
        <Button
          component={RouterLink}
          to="/account?redirectTo=/discover"
          variant="contained"
          size="large"
          endIcon={<ArrowForwardRounded />}
          sx={{ mt: 2 }}
        >
          Sign in for more searches
        </Button>
      )}
    </Box>
  );
}

export default function Discover({ loaderData }: Route.ComponentProps) { // eslint-disable-line complexity, max-lines-per-function -- route action/loader with many conditional branches; refactor in follow-up
  const { query, signedIn, search } = loaderData;
  const understoodFacets =
    search && search.ok
      ? [...search.understood.colors, ...search.understood.categories, ...search.understood.occasions]
      : [];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.04)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.04)} 1px, transparent 1px)`,
        backgroundSize: "36px 36px",
      }}
    >
      <Container sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={1.5} sx={{ alignItems: "flex-start", mb: 2 }}>
          <Button
            component={RouterLink}
            to="/"
            variant="text"
            startIcon={<StorefrontRounded />}
            sx={{
              px: 0,
              minHeight: 36,
              color: "text.secondary",
              fontWeight: 800,
              "& .MuiButton-startIcon": { mr: 1 },
              "&:hover": { bgcolor: "transparent", color: tokens.burgundy },
            }}
          >
            Back to storefront
          </Button>
          <Typography
            variant="caption"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.25,
              py: 0.55,
              borderRadius: 999,
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.16),
              bgcolor: alpha(tokens.burgundy, 0.07),
              color: tokens.burgundy,
              fontWeight: 950,
              letterSpacing: 0.3,
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            <AutoAwesomeRounded sx={{ fontSize: 14 }} /> AI search
          </Typography>
        </Stack>

        <Typography variant="h2" component="h1" sx={{ fontSize: { xs: "2.4rem", md: "3.6rem" }, maxWidth: 760 }}>
          Describe it. We'll find it.
        </Typography>
        <Typography sx={{ mt: 1.5, color: "text.secondary", maxWidth: 640, fontSize: { xs: 16, md: 18 } }}>
          Type what you're looking for in plain words — colour, occasion, budget —
          and Xtiitch searches every shop at once.
        </Typography>

        <Box
          sx={{
            mt: 3,
            p: { xs: 1.5, md: 2 },
            borderRadius: "12px",
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.1),
            bgcolor: "rgba(var(--surface-rgb), 0.94)",
            boxShadow: `0 18px 50px ${alpha(tokens.ink, 0.1)}`,
          }}
        >
          <Form method="get">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <TextField
                name="q"
                defaultValue={query}
                placeholder="red kente dress for a wedding under 800"
                aria-label="Describe what you want"
                required
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
              <Button type="submit" variant="contained" size="large" endIcon={<ArrowForwardRounded />} sx={{ flexShrink: 0 }}>
                Search
              </Button>
            </Stack>
          </Form>
          {search && (
            <Box sx={{ mt: 1.75, px: 0.5 }}>
              {search.ok ? (
                <QuotaMeter quota={search.quota} signedIn={signedIn} />
              ) : search.quota ? (
                <QuotaMeter quota={search.quota} signedIn={signedIn} />
              ) : null}
            </Box>
          )}
        </Box>

        {/* Example prompts (only before the first search) */}
        {!search && (
          <Stack direction="row" useFlexGap spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
            {EXAMPLES.map((ex) => (
              <Chip
                key={ex}
                component={RouterLink}
                to={`/discover?q=${encodeURIComponent(ex)}`}
                clickable
                label={ex}
                sx={{
                  fontWeight: 700,
                  bgcolor: alpha(tokens.burgundy, 0.12),
                  color: "text.primary",
                  border: "1px solid",
                  borderColor: alpha(tokens.burgundy, 0.3),
                  transition: "background-color .15s ease, border-color .15s ease",
                  "&:hover": {
                    bgcolor: alpha(tokens.burgundy, 0.2),
                    borderColor: tokens.burgundy,
                  },
                }}
              />
            ))}
          </Stack>
        )}

        {/* Results / states */}
        <Box sx={{ mt: 4 }}>
          {search && !search.ok && search.status === 402 && (
            <UpgradePrompt signedIn={signedIn} />
          )}

          {search && !search.ok && search.status !== 402 && (
            <Typography sx={{ color: "text.secondary" }}>
              {search.error === "empty_query"
                ? "Tell me what you're looking for to start a search."
                : "Something went wrong with that search — please try again."}
            </Typography>
          )}

          {search && search.ok && (
            <>
              {understoodFacets.length > 0 && (
                <Stack direction="row" useFlexGap spacing={0.75} sx={{ mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
                  <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700, mr: 0.5 }}>
                    Understood:
                  </Typography>
                  {understoodFacets.map((facet) => (
                    <Chip key={facet} size="small" label={facet} sx={{ fontWeight: 700, textTransform: "capitalize" }} />
                  ))}
                  {search.understood.price_max_minor > 0 && (
                    <Chip size="small" label={`under ${formatGHS(search.understood.price_max_minor)}`} sx={{ fontWeight: 700 }} />
                  )}
                </Stack>
              )}

              {search.results.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <Typography variant="h6">No matches yet</Typography>
                  <Typography sx={{ mt: 1, color: "text.secondary" }}>
                    Try fewer details or a different occasion — e.g. “ankara dress”.
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: {
                      xs: "repeat(2, minmax(0, 1fr))",
                      sm: "repeat(3, minmax(0, 1fr))",
                      md: "repeat(4, minmax(0, 1fr))",
                    },
                  }}
                >
                  {search.results.map((hit) => (
                    <ResultCard key={`${hit.store_handle}-${hit.design_handle}`} hit={hit} />
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
}
