import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { type Faq } from "../../content";
import { riseInSx } from "./shared";

export function FaqList({ items }: { items: Faq[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        alignItems: "start",
        maxWidth: 1080,
        mx: "auto",
      }}
    >
      {items.map((faq, index) => (
        <Accordion
          key={faq.question}
          disableGutters
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            "&:before": { display: "none" },
            bgcolor: "rgba(var(--surface-rgb), 0.9)",
            overflow: "hidden",
            transition: "border-color 200ms ease, box-shadow 200ms ease",
            ...riseInSx(50 + index * 40),
            "&:hover": { borderColor: "rgba(128,0,32,0.22)" },
            "&.Mui-expanded": {
              borderColor: "rgba(128,0,32,0.32)",
              boxShadow: "0 26px 60px -50px rgba(21,17,26,0.6)",
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: "primary.main" }} />}
            sx={{
              px: 2,
              minHeight: 56,
              "& .MuiAccordionSummary-content": {
                alignItems: "center",
                gap: 1.5,
                my: 1.25,
              },
            }}
          >
            <Box
              component="span"
              aria-hidden
              sx={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid rgba(128,0,32,0.28)",
                color: "primary.main",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 12.5,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>
              {faq.question}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 2, pl: { xs: 2, sm: 7 }, pr: 2 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {faq.answer}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
