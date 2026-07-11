import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import { tokens } from "../../theme";

// A calm, in-store "nothing here" panel. Shown when a shared design or collection
// link resolves to something that has since been unpublished or removed, so a
// stale link lands on a friendly message with a way back into the store rather
// than a hard error page.
export function StoreNotice({
  title,
  message,
  actionTo = "/",
  actionLabel = "Back to store",
}: {
  title: string;
  message: string;
  actionTo?: string;
  actionLabel?: string;
}) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "80vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Container sx={{ textAlign: "center", maxWidth: 520 }}>
        <Box
          aria-hidden
          sx={{
            display: "inline-flex",
            p: 2,
            mb: 2.5,
            borderRadius: "50%",
            color: "primary.main",
            bgcolor: alpha(tokens.burgundy, 0.1),
            "& .MuiSvgIcon-root": { fontSize: 40 },
          }}
        >
          <StorefrontOutlined />
        </Box>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        <Typography sx={{ mt: 2, color: "text.secondary" }}>
          {message}
        </Typography>
        <Button
          component={RouterLink}
          to={actionTo}
          variant="contained"
          size="large"
          sx={{ mt: 4 }}
        >
          {actionLabel}
        </Button>
      </Container>
    </Box>
  );
}
