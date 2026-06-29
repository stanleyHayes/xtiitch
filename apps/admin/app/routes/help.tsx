import type { MetaDescriptor } from "react-router";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import MenuBookRounded from "@mui/icons-material/MenuBookRounded";
import { tokens } from "../theme";
import { HELP_INTRO, HELP_GUIDES, spokenAll } from "../lib/help-content";
import { SpeakButton, HelpGuideCard } from "../help-center";

export function meta(): MetaDescriptor[] {
  return [
    { title: "How to use the Xtiitch admin console · Operator guide" },
    {
      name: "description",
      content:
        "A plain guide to every section of the Xtiitch admin console — what each one is for and how to use it. Read it, or listen.",
    },
    { name: "robots", content: "noindex" },
  ];
}

export default function Help() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.04)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.04)} 1px, transparent 1px)`,
        backgroundSize: "36px 36px",
      }}
    >
      <Container sx={{ py: { xs: 4, md: 7 }, maxWidth: "md" }}>
        <Button
          component={RouterLink}
          to="/admin"
          variant="text"
          startIcon={<ArrowBackRounded />}
          sx={{ px: 0, color: "text.secondary", fontWeight: 800, mb: 2 }}
        >
          Back to console
        </Button>

        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", mb: 1.5 }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(tokens.burgundy, 0.1),
              color: tokens.burgundy,
            }}
          >
            <MenuBookRounded />
          </Box>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontSize: { xs: "2.1rem", md: "2.8rem" } }}
          >
            How to use the admin console
          </Typography>
        </Stack>

        <Typography
          sx={{ color: "text.secondary", maxWidth: 680, lineHeight: 1.7 }}
        >
          {HELP_INTRO}
        </Typography>

        <Box sx={{ mt: 2.5 }}>
          <SpeakButton
            text={spokenAll()}
            label="Listen to the whole guide"
            size="large"
          />
        </Box>

        {/* Quick jump */}
        <Box sx={{ mt: 3, display: "flex", flexWrap: "wrap", gap: 1 }}>
          {HELP_GUIDES.map((guide) => (
            <Button
              key={guide.section}
              href={`#${guide.section}`}
              size="small"
              variant="outlined"
              sx={{
                borderColor: alpha(tokens.ink, 0.15),
                color: "text.primary",
              }}
            >
              {guide.title}
            </Button>
          ))}
        </Box>

        <Stack spacing={2.5} sx={{ mt: 4 }}>
          {HELP_GUIDES.map((guide) => (
            <Box
              key={guide.section}
              id={guide.section}
              sx={{ scrollMarginTop: 24 }}
            >
              <HelpGuideCard guide={guide} elevated />
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
