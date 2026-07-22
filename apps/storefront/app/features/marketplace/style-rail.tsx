import { Link as RouterLink } from "react-router";
import ArrowForwardIosRounded from "@mui/icons-material/ArrowForwardIosRounded";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { FlatDesign } from "./types";
import { tokens } from "../../theme";

const categories = [
  { label: "Wedding guest", helper: "Elegant looks", query: "wedding guest" },
  { label: "Kente & Adire", helper: "Heritage weaves", query: "kente adire" },
  { label: "Menswear", helper: "Sharp & modern", query: "menswear" },
  { label: "Ready to wear", helper: "Everyday styles", query: "ready to wear" },
  { label: "Accessories", helper: "Finishing touches", query: "accessories" },
  { label: "Bridal", helper: "Timeless beauty", query: "bridal" },
] as const;

const fallbackImages = [
  "/images/storefront-fitting.webp",
  "/images/storefront-atelier-review.webp",
  "/images/storefront-atelier-hero.webp",
];

export function StyleRail({ designs }: { designs: FlatDesign[] }) {
  return (
    <Box
      component="section"
      sx={{
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Container maxWidth="xl" sx={{ py: 1.6 }}>
        <Stack direction="row" spacing={2.5} sx={{ alignItems: "center" }}>
          <Typography
            variant="overline"
            sx={{
              flex: "0 0 auto",
              width: { xs: 96, md: 118 },
              color: tokens.burgundy,
              fontWeight: 900,
              lineHeight: 1.35,
              letterSpacing: "0.11em",
            }}
          >
            Explore
            <br />
            by style
          </Typography>
          <Stack
            direction="row"
            spacing={{ xs: 2.5, md: 4 }}
            sx={{ overflowX: "auto", flex: 1, pb: 0.5, scrollbarWidth: "thin" }}
          >
            {categories.map((category, index) => {
              const image =
                designs[index]?.image ||
                fallbackImages[index % fallbackImages.length];
              return (
                <Stack
                  key={category.label}
                  component={RouterLink}
                  to={`/discover?q=${encodeURIComponent(category.query)}`}
                  direction="row"
                  spacing={1.15}
                  sx={{
                    alignItems: "center",
                    minWidth: 174,
                    color: "text.primary",
                    textDecoration: "none",
                    "&:hover .style-arrow": {
                      transform: "translateX(3px)",
                      color: tokens.burgundy,
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={image}
                    alt=""
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "1px solid",
                      borderColor: alpha(tokens.ink, 0.1),
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 850 }} noWrap>
                      {category.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                      noWrap
                    >
                      {category.helper}
                    </Typography>
                  </Box>
                  <ArrowForwardIosRounded
                    className="style-arrow"
                    sx={{
                      ml: "auto",
                      fontSize: 14,
                      transition: "transform .18s ease",
                    }}
                  />
                </Stack>
              );
            })}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
