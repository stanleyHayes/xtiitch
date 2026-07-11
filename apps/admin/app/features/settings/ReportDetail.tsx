import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { AdminReportItem, Section } from "../shared/types";
import { reportStatusColor } from "../shared/colors";

export function ReportDetail({
  item,
  onSelect,
}: {
  item: AdminReportItem;
  onSelect: (section: Section) => void;
}) {
  const color = reportStatusColor(item.status);
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: alpha(color, 0.2),
        bgcolor: alpha(color, 0.045),
        backgroundImage: `linear-gradient(90deg, ${alpha(
          color,
          0.07,
        )}, transparent 36%)`,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{
          alignItems: { md: "center" },
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography sx={{ fontWeight: 900 }}>{item.label}</Typography>
            <Chip
              size="small"
              label={item.status}
              sx={{
                bgcolor: alpha(color, 0.12),
                color,
                textTransform: "capitalize",
                fontWeight: 900,
              }}
            />
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", fontWeight: 900 }}
            >
              {item.value}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            sx={{ mt: 0.65, color: "text.secondary" }}
          >
            {item.helper}
          </Typography>
        </Box>
        <Button
          variant={item.status === "blocked" ? "contained" : "outlined"}
          size="small"
          endIcon={<ArrowForwardRounded />}
          onClick={() => onSelect(item.target)}
          sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
        >
          {item.targetLabel}
        </Button>
      </Stack>
    </Box>
  );
}
