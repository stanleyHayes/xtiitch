import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";

// One AI-search hit: the design cover, its title, the store it comes from and
// the price. Clicking lands on that store's page (marketplace-only feature —
// the whole /discover page 404s on tenant hosts, §5.4).
export function ResultCard({
  hit,
}: {
  hit: {
    design_title: string;
    image: string;
    price_minor: number;
    store_name: string;
    store_handle: string;
  };
}) {
  return (
    <Box
      component={RouterLink}
      to={`/store/${encodeURIComponent(hit.store_handle)}`}
      sx={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: "10px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        bgcolor: "rgba(var(--surface-rgb), 0.92)",
        transition: "transform .18s ease, box-shadow .18s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: `0 20px 50px ${alpha(tokens.ink, 0.14)}`,
          borderColor: alpha(tokens.burgundy, 0.3),
        },
      }}
    >
      <Box
        sx={{
          aspectRatio: "4 / 5",
          bgcolor: alpha(tokens.ink, 0.05),
          backgroundImage: hit.image ? `url(${hit.image})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "grid",
          placeItems: "center",
        }}
      >
        {!hit.image && <StorefrontRounded sx={{ color: alpha(tokens.ink, 0.25), fontSize: 40 }} />}
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }} noWrap>
          {hit.design_title}
        </Typography>
        <Stack direction="row" sx={{ mt: 0.5, justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
            {hit.store_name}
          </Typography>
          <Typography sx={{ fontWeight: 900, color: tokens.burgundy, flexShrink: 0 }}>
            {formatGHS(hit.price_minor)}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
