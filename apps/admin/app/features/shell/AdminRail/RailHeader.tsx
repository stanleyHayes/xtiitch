import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import { tokens } from "../../../theme";

export function RailHeader({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
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
        overflow: "hidden",
        p: collapsed ? 0.75 : 1.25,
        border: "1px solid",
        borderColor: alpha(tokens.gold, 0.22),
        borderRadius: 2.5,
        color: tokens.white,
        backgroundColor: alpha(tokens.white, 0.05),
        backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${alpha(tokens.gold, 0.16)} 0%, transparent 44%), linear-gradient(150deg, ${alpha(tokens.burgundy, 0.5)} 0%, ${alpha(tokens.ink, 0)} 62%)`,
        backdropFilter: "blur(14px)",
        boxShadow: `0 18px 44px ${alpha(tokens.ink, 0.42)}, inset 0 1px 0 ${alpha(tokens.white, 0.12)}`,
        "&::before": {
          content: '""',
          position: "absolute",
          insetInline: 14,
          top: 0,
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${alpha(tokens.gold, 0.7)}, transparent)`,
        },
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
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              color: tokens.white,
              overflow: "hidden",
              backgroundImage: brandLogoUrl
                ? `linear-gradient(155deg, ${alpha(tokens.white, 0.06)}, ${alpha(tokens.charcoal, 0.18)})`
                : `linear-gradient(155deg, ${tokens.burgundy} 0%, ${tokens.charcoal} 100%)`,
              border: `1px solid ${alpha(tokens.gold, 0.5)}`,
              boxShadow: `0 14px 30px ${alpha(tokens.burgundy, 0.5)}, inset 0 1px 0 ${alpha(tokens.white, 0.22)}`,
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
                  fontSize: 18,
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
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0,
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
