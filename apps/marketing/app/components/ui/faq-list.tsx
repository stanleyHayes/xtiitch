import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import type { SvgIconComponent } from "@mui/icons-material";
import { type Faq } from "../../content";
import { riseInSx } from "./shared";

type FaqGroup = {
  title: string;
  eyebrow: string;
  accent: string;
  Icon: SvgIconComponent;
  from: number;
  to: number;
};

const groups: FaqGroup[] = [
  {
    title: "Getting started",
    eyebrow: "Store & selling",
    accent: "#800020",
    Icon: StorefrontRoundedIcon,
    from: 0,
    to: 4,
  },
  {
    title: "Orders and money",
    eyebrow: "Payments & fulfilment",
    accent: "#b87914",
    Icon: PaymentsRoundedIcon,
    from: 4,
    to: 10,
  },
  {
    title: "Brand and trust",
    eyebrow: "Identity & security",
    accent: "#237a4b",
    Icon: ShieldRoundedIcon,
    from: 10,
    to: 14,
  },
];

function FaqItem({
  faq,
  number,
  accent,
}: {
  faq: Faq;
  number: number;
  accent: string;
}) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "transparent",
        "&:before": { display: "none" },
        "&:first-of-type": { borderTop: 0 },
        "&.Mui-expanded": { m: 0 },
      }}
    >
      <AccordionSummary
        expandIcon={
          <Box
            aria-hidden
            sx={{
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              color: accent,
              bgcolor: `${accent}0d`,
              transition: "background-color 180ms ease",
            }}
          >
            <ExpandMoreRoundedIcon />
          </Box>
        }
        sx={{
          px: 0,
          minHeight: 74,
          "& .MuiAccordionSummary-content": {
            alignItems: "center",
            gap: { xs: 1.25, sm: 1.75 },
            my: 1.25,
          },
          "&:hover .faq-number": {
            color: "common.white",
            bgcolor: accent,
            borderColor: accent,
          },
        }}
      >
        <Box
          className="faq-number"
          component="span"
          aria-hidden
          sx={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 1.25,
            border: "1px solid",
            borderColor: `${accent}34`,
            color: accent,
            bgcolor: `${accent}08`,
            display: "grid",
            placeItems: "center",
            fontWeight: 850,
            fontSize: 12,
            transition:
              "color 180ms ease, background-color 180ms ease, border-color 180ms ease",
          }}
        >
          {String(number + 1).padStart(2, "0")}
        </Box>
        <Typography
          sx={{
            pr: 1,
            fontWeight: 850,
            fontSize: { xs: 15, sm: 16 },
            lineHeight: 1.35,
          }}
        >
          {faq.question}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 2.5, pl: { xs: 0, sm: 7 }, pr: 1 }}>
        <Typography
          variant="body2"
          sx={{ maxWidth: 700, color: "text.secondary", lineHeight: 1.75 }}
        >
          {faq.answer}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}

export function FaqList({ items }: { items: Faq[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 2, lg: 2.5 },
        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0,1fr))" },
        alignItems: "start",
        maxWidth: 1180,
        mx: "auto",
      }}
    >
      {groups.map((group, groupIndex) => {
        const Icon = group.Icon;
        const questions = items.slice(group.from, group.to);
        return (
          <Box
            key={group.title}
            sx={{
              gridColumn: {
                xs: "auto",
                lg: groupIndex === 1 ? "2" : "1",
              },
              gridRow: { lg: groupIndex === 2 ? "2" : "auto" },
              overflow: "hidden",
              border: "1px solid",
              borderColor: `${group.accent}24`,
              borderRadius: 2.5,
              bgcolor: "rgba(var(--surface-rgb),0.9)",
              boxShadow: "0 26px 70px -54px rgba(21,17,26,0.58)",
              ...riseInSx(60 + groupIndex * 80),
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: { xs: 2, sm: 2.5 },
                py: 2,
                color: "common.white",
                bgcolor: group.accent,
              }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 1.25,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                <Icon fontSize="small" />
              </Box>
              <Box>
                <Typography
                  variant="overline"
                  sx={{
                    display: "block",
                    color: "rgba(255,255,255,0.62)",
                    letterSpacing: "0.1em",
                    lineHeight: 1.2,
                  }}
                >
                  {group.eyebrow}
                </Typography>
                <Typography sx={{ mt: 0.25, fontWeight: 850, lineHeight: 1.2 }}>
                  {group.title}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{ ml: "auto", color: "rgba(255,255,255,0.66)" }}
              >
                {questions.length} questions
              </Typography>
            </Box>
            <Box sx={{ px: { xs: 2, sm: 2.5 } }}>
              {questions.map((faq, index) => (
                <FaqItem
                  key={faq.question}
                  faq={faq}
                  number={group.from + index}
                  accent={group.accent}
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
