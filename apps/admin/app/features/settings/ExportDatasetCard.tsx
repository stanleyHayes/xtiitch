import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { AdminExportDataset, Section } from "../shared/types";
import { reportStatusColor } from "../shared/colors";
import { Panel } from "../../components/ui/Panel";
import { ExportActions } from "./ExportActions";

export function ExportDatasetCard({
  dataset,
  onSelect,
}: {
  dataset: AdminExportDataset;
  onSelect: (section: Section) => void;
}) {
  const color = reportStatusColor(dataset.tone);
  const rowCount = Math.max(dataset.rows.length - 1, 0);
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(color, 0.2),
        backgroundImage: `
          linear-gradient(90deg, ${alpha(color, 0.07)}, transparent 34%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "flex-start" }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(color, 0.12),
              color,
              flex: "0 0 auto",
            }}
          >
            <FileDownloadRounded />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography variant="h6">{dataset.title}</Typography>
              <Chip
                size="small"
                label={dataset.tone}
                sx={{
                  bgcolor: alpha(color, 0.12),
                  color,
                  textTransform: "capitalize",
                  fontWeight: 900,
                }}
              />
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary" }}
            >
              {rowCount} rows · {dataset.helper}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ flexWrap: "wrap" }}
        >
          <ExportActions
            datasetId={dataset.id}
            source={dataset.source}
            sourceLabel={dataset.sourceLabel}
            onSelect={onSelect}
          />
        </Stack>
      </Stack>
    </Panel>
  );
}
