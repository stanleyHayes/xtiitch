import { Link as RouterLink } from "react-router";
import ArrowForwardIosRounded from "@mui/icons-material/ArrowForwardIosRounded";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { styleCategories } from "./style-categories";

export function StyleRail() {
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
            {styleCategories.map((category) => {
              return (
                <Stack
                  key={category.label}
                  component={RouterLink}
                  to={`/discover?style=${encodeURIComponent(category.slug)}&q=${encodeURIComponent(category.query)}`}
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
                    src={category.image}
                    alt={`${category.label} style`}
                    loading="lazy"
                    sx={{
                      width: 52,
                      height: 52,
                      flexShrink: 0,
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
