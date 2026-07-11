import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { type Step } from "../../content";
import { riseInSx } from "./shared";

export function StepList({ items }: { items: Step[] }) {
  return (
    <Box
      sx={{
        position: "relative",
        display: "grid",
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
        "&:before": {
          content: { xs: "none", lg: '""' },
          position: "absolute",
          left: "8%",
          right: "8%",
          top: 32,
          height: 2,
          background:
            "linear-gradient(90deg, rgba(128,0,32,0.2), rgba(184,121,20,0.26), rgba(35,122,75,0.22))",
        },
      }}
    >
      {items.map((step, index) => (
        <Box
          key={step.number}
          sx={{
            position: "relative",
            display: "flex",
            gap: 2,
            p: 2.5,
            border: "1px solid",
            borderColor: index === 0 ? "rgba(128,0,32,0.26)" : "divider",
            borderRadius: 1,
            bgcolor:
              index === 0
                ? "rgba(var(--surface-rgb),0.94)"
                : "background.paper",
            minHeight: 168,
            boxShadow:
              index === 0 ? "0 28px 68px -54px rgba(128,0,32,0.72)" : "none",
            transition:
              "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
            ...riseInSx(80 + index * 70),
            "&:hover": {
              transform: "translateY(-3px)",
              borderColor: "rgba(128,0,32,0.2)",
              boxShadow: "0 26px 60px -48px rgba(21,17,26,0.55)",
            },
          }}
        >
          <Box
            aria-hidden
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 1,
              bgcolor: index === 0 ? "primary.main" : "background.default",
              color: index === 0 ? "primary.contrastText" : "primary.main",
              border: "1px solid",
              borderColor: index === 0 ? "primary.main" : "rgba(128,0,32,0.18)",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              boxShadow:
                index === 0 ? "0 12px 30px -18px rgba(128,0,32,0.9)" : "none",
            }}
          >
            {step.number}
          </Box>
          <Box>
            <Typography variant="h6" component="h3">
              {step.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              {step.body}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
