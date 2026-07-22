import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import { tokens } from "../../../theme";

export function RailHeader({
  collapsed,
  brandLogoUrl,
  onClose,
}: {
  collapsed: boolean;
  brandLogoUrl: string;
  onClose?: () => void;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "visible",
        p: collapsed ? 0.5 : 0.65,
        border: 0,
        borderRadius: 1.5,
        color: tokens.white,
        backgroundColor: "transparent",
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          <Box
            sx={{
              position: "relative",
              width: collapsed ? 44 : 48,
              height: collapsed ? 44 : 48,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              color: tokens.white,
              overflow: "hidden",
              backgroundImage: brandLogoUrl
                ? `linear-gradient(155deg, ${alpha(tokens.white, 0.06)}, ${alpha(tokens.charcoal, 0.18)})`
                : `linear-gradient(155deg, ${tokens.burgundy} 0%, ${tokens.charcoal} 100%)`,
              border: `1px solid ${alpha(tokens.gold, 0.5)}`,
              boxShadow: `0 10px 24px ${alpha(tokens.burgundy, 0.4)}, inset 0 1px 0 ${alpha(tokens.white, 0.22)}`,
            }}
          >
            {brandLogoUrl ? (
              <Box
                component="img"
                src={brandLogoUrl}
                alt=""
                aria-hidden
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  p: 0.75,
                }}
              />
            ) : (
              <>
                <Box
                  component="img"
                  src="/favicon.svg"
                  alt=""
                  aria-hidden
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    p: 0.85,
                  }}
                />
                <ShieldRounded
                  sx={{
                    position: "absolute",
                    right: -6,
                    bottom: -6,
                    fontSize: 16,
                    p: "2px",
                    borderRadius: "50%",
                    color: tokens.charcoal,
                    bgcolor: tokens.gold,
                    boxShadow: `0 4px 10px ${alpha(tokens.ink, 0.5)}`,
                  }}
                />
              </>
            )}
          </Box>
          {!collapsed ? (
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: '"Fraunces", serif',
                  fontSize: 20,
                  fontWeight: 850,
                  lineHeight: 1.15,
                  color: tokens.white,
                }}
                noWrap
              >
                Xtiitch
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: tokens.gold,
                }}
              >
                Admin console
              </Typography>
            </Box>
          ) : null}
        </Stack>
        {onClose ? (
          <IconButton
            aria-label="Close navigation"
            onClick={onClose}
            sx={{
              color: tokens.white,
              border: "1px solid",
              borderColor: alpha(tokens.white, 0.14),
              bgcolor: "rgba(var(--surface-rgb), 0.06)",
            }}
          >
            <CloseRounded />
          </IconButton>
        ) : null}
      </Stack>
    </Box>
  );
}
