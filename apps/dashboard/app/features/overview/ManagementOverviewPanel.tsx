import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { tokens } from "../../theme";
import { OverviewRoom } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { ToneChip } from "../../components/ui/ToneChip";

export function ManagementOverviewPanel({ rooms }: { rooms: OverviewRoom[] }) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.065)}, transparent 44%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.94), rgba(var(--surface-rgb), 0.7))`,
      }}
    >
      <SectionHeader
        eyebrow="Overview"
        title="Choose the right workspace"
        helper="Start with the room that matches the work in front of you, from production to money to customer follow-up."
      />
      <Box
        sx={{
          mt: 2,
          display: "grid",
          gap: 1.4,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
          },
        }}
      >
        {rooms.map((room) => (
          <MuiLink
            key={room.href}
            component={RouterLink}
            to={room.href}
            underline="none"
            aria-label={`${room.actionLabel}: ${room.title}`}
            sx={{
              p: 1.65,
              border: "1px solid",
              borderColor: alpha(room.tone, 0.2),
              borderRadius: 2,
              bgcolor: "rgba(var(--surface-rgb), 0.78)",
              backgroundImage: `linear-gradient(135deg, ${alpha(room.tone, 0.08)}, transparent 48%)`,
              color: "text.primary",
              minWidth: 0,
              display: "grid",
              gap: 1.25,
              position: "relative",
              overflow: "hidden",
              textDecoration: "none",
              boxShadow: `0 14px 34px ${alpha(tokens.ink, 0.045)}`,
              transition:
                "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
              "&::after": {
                content: '""',
                position: "absolute",
                right: -28,
                bottom: -34,
                width: 94,
                height: 94,
                borderRadius: "50%",
                bgcolor: alpha(room.tone, 0.055),
                border: `1px solid ${alpha(room.tone, 0.12)}`,
              },
              "&:hover": {
                transform: "translateY(-2px)",
                borderColor: alpha(room.tone, 0.34),
                boxShadow: `0 22px 50px ${alpha(tokens.ink, 0.075)}`,
                "& .workspace-arrow": { transform: "translateX(2px)" },
              },
              "&:focus-visible": {
                outline: `3px solid ${alpha(room.tone, 0.32)}`,
                outlineOffset: 3,
              },
            }}
          >
            <Stack
              direction="row"
              spacing={1.35}
              sx={{ alignItems: "flex-start", minWidth: 0 }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 1.5,
                  display: "grid",
                  placeItems: "center",
                  color: room.tone,
                  bgcolor: alpha(room.tone, 0.1),
                  border: "1px solid",
                  borderColor: alpha(room.tone, 0.18),
                  boxShadow: `0 12px 26px ${alpha(room.tone, 0.08)}`,
                  flexShrink: 0,
                }}
              >
                {room.icon}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 900 }}>{room.title}</Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.4, color: "text.secondary" }}
                >
                  {room.helper}
                </Typography>
              </Box>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <ToneChip label={room.value} tone={room.tone} />
              <Box
                sx={{
                  minHeight: 34,
                  px: 1.15,
                  borderRadius: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  border: "1px solid",
                  bgcolor: "rgba(var(--surface-rgb), 0.72)",
                  borderColor: alpha(room.tone, 0.2),
                  color: room.tone,
                  fontSize: 13,
                  fontWeight: 850,
                  whiteSpace: "nowrap",
                }}
              >
                {room.actionLabel}
                <ArrowForwardRounded
                  className="workspace-arrow"
                  sx={{ fontSize: 17, transition: "transform 180ms ease" }}
                />
              </Box>
            </Stack>
          </MuiLink>
        ))}
      </Box>
    </Panel>
  );
}