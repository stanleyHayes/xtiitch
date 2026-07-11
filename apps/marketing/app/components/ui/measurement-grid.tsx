import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import { riseInSx } from "./shared";

const measurementIcons = [
  ChecklistRoundedIcon,
  GroupsRoundedIcon,
  StorefrontRoundedIcon,
  PaymentsRoundedIcon,
] as const;

const measurementAccents = [
  "#800020",
  "#315f8f",
  "#b87914",
  "#237a4b",
] as const;

export function MeasurementRouteGrid({
  items,
}: {
  items: { title: string; body: string; deposit: string }[];
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "1fr 1fr",
          lg: "repeat(4, 1fr)",
        },
      }}
    >
      {items.map((route, index) => {
        const Icon = measurementIcons[index] ?? ChecklistRoundedIcon;
        const accent = measurementAccents[index] ?? "#800020";
        return (
          <Box
            key={route.title}
            sx={{
              position: "relative",
              p: 3,
              borderRadius: 1,
              border: "1px solid",
              borderColor: index === 0 ? `${accent}55` : "divider",
              bgcolor: "rgba(var(--surface-rgb), 0.86)",
              overflow: "hidden",
              minHeight: 254,
              boxShadow:
                index === 0
                  ? "0 28px 70px -54px rgba(128,0,32,0.7)"
                  : "0 22px 60px -50px rgba(21,17,26,0.42)",
              transition:
                "transform 190ms ease, border-color 190ms ease, box-shadow 190ms ease",
              ...riseInSx(90 + index * 65),
              "&:hover": {
                transform: "translateY(-3px)",
                borderColor: `${accent}66`,
                boxShadow: "0 30px 72px -52px rgba(21,17,26,0.58)",
              },
              "&:before": {
                content: '""',
                position: "absolute",
                inset: "0 0 auto 0",
                height: 5,
                bgcolor: accent,
              },
            }}
          >
            <Icon
              aria-hidden
              sx={{
                position: "absolute",
                right: -18,
                bottom: -18,
                fontSize: 112,
                color: `${accent}14`,
                transform: "rotate(-7deg)",
              }}
            />
            <Box sx={{ position: "relative" }}>
              <Box
                aria-hidden
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1,
                  mb: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: `${accent}12`,
                  color: accent,
                  border: "1px solid",
                  borderColor: `${accent}24`,
                }}
              >
                <Icon fontSize="small" />
              </Box>
              <Typography variant="h6" component="h3">
                {route.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, color: "text.secondary" }}
              >
                {route.body}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={route.deposit}
                sx={{
                  mt: 2,
                  bgcolor: "background.paper",
                  borderColor: `${accent}40`,
                  color: accent,
                  maxWidth: "100%",
                  "& .MuiChip-label": {
                    whiteSpace: "normal",
                    py: 0.4,
                  },
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
