import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import type {
  CapabilityArea,
  CapabilityItem,
  PlanCapabilityRow,
} from "../../content";

const areaColors = ["#800020", "#315f8f", "#2f6b4f"] as const;
const planNames = ["Free", "Starter", "Growth", "Studio"] as const;

function CapabilityLine({
  item,
  color,
}: {
  item: CapabilityItem;
  color: string;
}) {
  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.25 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: "background.paper",
        minHeight: 190,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography variant="h6" component="h3">
        {item.title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ mt: 0.75, color: "text.secondary", lineHeight: 1.65 }}
      >
        {item.body}
      </Typography>
      <Box
        sx={{
          mt: "auto",
          pt: 1.5,
          display: "flex",
          gap: 0.75,
          alignItems: "flex-start",
        }}
      >
        <CheckCircleRoundedIcon
          aria-hidden
          sx={{ mt: "2px", color, fontSize: 17, flexShrink: 0 }}
        />
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {item.availability}
        </Typography>
      </Box>
    </Box>
  );
}

function CapabilityAreaBlock({
  area,
  index,
}: {
  area: CapabilityArea;
  index: number;
}) {
  const color = areaColors[index % areaColors.length] ?? areaColors[0];
  return (
    <Box
      component="section"
      sx={{
        p: { xs: 2, md: 3 },
        border: "1px solid",
        borderColor: `${color}2b`,
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb), 0.78)",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, md: 4 },
          gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 0.55fr) 1fr" },
          alignItems: "end",
          mb: 3,
        }}
      >
        <Box>
          <Chip
            size="small"
            label={area.label}
            sx={{
              mb: 1.25,
              bgcolor: `${color}12`,
              color,
              fontWeight: 900,
            }}
          />
          <Typography variant="h3" component="h2">
            {area.title}
          </Typography>
        </Box>
        <Typography sx={{ color: "text.secondary", maxWidth: 700 }}>
          {area.summary}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        {area.items.map((item) => (
          <CapabilityLine key={item.title} item={item} color={color} />
        ))}
      </Box>
    </Box>
  );
}

export function CapabilityDirectory({
  areas,
}: {
  areas: CapabilityArea[];
}) {
  return (
    <Stack spacing={{ xs: 2.5, md: 3.5 }}>
      {areas.map((area, index) => (
        <CapabilityAreaBlock key={area.label} area={area} index={index} />
      ))}
    </Stack>
  );
}

function PlanValueGrid({ row }: { row: PlanCapabilityRow }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },
        borderTop: { xs: "1px solid", lg: "none" },
        borderColor: "divider",
      }}
    >
      {row.values.map((value, index) => (
        <Box
          key={planNames[index]}
          sx={{
            minWidth: 0,
            p: 1.75,
            borderLeft: {
              xs: index % 2 === 1 ? "1px solid" : "none",
              lg: "1px solid",
            },
            borderTop: {
              xs: index > 1 ? "1px solid" : "none",
              lg: "none",
            },
            borderColor: "divider",
            bgcolor:
              index === 2
                ? "rgba(128,0,32,0.035)"
                : "rgba(var(--surface-rgb), 0.5)",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: index === 2 ? "primary.main" : "text.secondary",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {planNames[index]}
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 0.5, fontWeight: 750, lineHeight: 1.45 }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function PlanCapabilityMatrix({
  rows,
}: {
  rows: PlanCapabilityRow[];
}) {
  return (
    <Stack
      spacing={1}
      sx={{
        "& > *": {
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: "background.paper",
        },
      }}
    >
      {rows.map((row) => (
        <Box
          key={row.capability}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(240px, 0.8fr) 2fr" },
          }}
        >
          <Box sx={{ p: 1.75 }}>
            <Typography sx={{ fontWeight: 900 }}>{row.capability}</Typography>
            <Typography
              variant="caption"
              sx={{ mt: 0.4, display: "block", color: "text.secondary" }}
            >
              {row.helper}
            </Typography>
          </Box>
          <PlanValueGrid row={row} />
        </Box>
      ))}
    </Stack>
  );
}
