import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { Panel } from "../../components/ui/Panel";
import { CardDetailAction } from "../shared/CardDetailAction";
import { OverviewBar } from "./types";



export function OverviewBreakdownCard({
  title,
  subtitle,
  items,
  onView,
}: {
  title: string;
  subtitle: string;
  items: OverviewBar[];
  onView: () => void;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {subtitle}
          </Typography>
        </Box>
        <Stack spacing={1.1}>
          {items.map((item) => (
            <Box key={item.label}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", mb: 0.4 }}
              >
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {item.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {item.value}
                </Typography>
              </Stack>
              <Box
                sx={{
                  height: 8,
                  borderRadius: 999,
                  overflow: "hidden",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? alpha(tokens.white, 0.08)
                      : alpha(tokens.ink, 0.06),
                }}
              >
                <Box
                  sx={{
                    height: "100%",
                    width: `${Math.round((item.value / max) * 100)}%`,
                    minWidth: item.value > 0 ? 6 : 0,
                    borderRadius: 999,
                    bgcolor: item.color,
                    transition: "width 240ms ease",
                  }}
                />
              </Box>
            </Box>
          ))}
        </Stack>
        <CardDetailAction onClick={onView} label="Open" />
      </Stack>
    </Panel>
  );
}
