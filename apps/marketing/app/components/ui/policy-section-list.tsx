import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import { riseInSx } from "./shared";

export function PolicySectionList({
  items,
}: {
  items: { title: string; body: string }[];
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
      }}
    >
      {items.map((section, index) => {
        const accent =
          index % 3 === 0 ? "#800020" : index % 3 === 1 ? "#315f8f" : "#2f6b4f";
        return (
          <Box
            key={section.title}
            sx={{
              position: "relative",
              minHeight: 248,
              p: { xs: 2.5, md: 3 },
              border: "1px solid",
              borderColor: index === 0 ? `${accent}55` : "divider",
              borderRadius: 1,
              bgcolor: "rgba(var(--surface-rgb), 0.88)",
              overflow: "hidden",
              boxShadow:
                index === 0
                  ? "0 28px 72px -56px rgba(128,0,32,0.72)"
                  : "0 22px 58px -52px rgba(21,17,26,0.44)",
              ...riseInSx(70 + index * 50),
              "&:before": {
                content: '""',
                position: "absolute",
                inset: "0 0 auto 0",
                height: 5,
                bgcolor: accent,
              },
            }}
          >
            <Typography
              aria-hidden
              component="p"
              sx={{
                position: "absolute",
                right: 18,
                top: 8,
                fontFamily: "inherit",
                fontSize: 80,
                lineHeight: 1,
                color: `${accent}12`,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </Typography>
            <Box sx={{ position: "relative" }}>
              <Box
                aria-hidden
                sx={{
                  width: 42,
                  height: 42,
                  mb: 2,
                  borderRadius: 1,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: `${accent}12`,
                  color: accent,
                  border: "1px solid",
                  borderColor: `${accent}24`,
                }}
              >
                <ReceiptLongRoundedIcon fontSize="small" />
              </Box>
              <Typography variant="h5" component="h2">
                {section.title}
              </Typography>
              <Typography sx={{ mt: 1, color: "text.secondary" }}>
                {section.body}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
