import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const homeRiseSx = (delayMs = 0) => ({
  animation: `xtiitch-rise-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

const imageStories = [
  {
    title: "Design review",
    body: "Show the customer the finished piece, keep the order record behind it.",
    image: "/images/atelier-review.webp",
    alt: "Fashion designer and customer reviewing a burgundy kente-trim garment in an atelier",
  },
  {
    title: "Payment handoff",
    body: "Package the garment, collect payment, and keep the sale tied to the customer.",
    image: "/images/payment-handoff.webp",
    alt: "Fashion business owner handing a packaged garment to a customer beside a phone storefront",
  },
  {
    title: "Fitting progress",
    body: "Move the garment through stages while the customer sees a calm progress view.",
    image: "/images/tracking-fitting.webp",
    alt: "Tailor fitting a burgundy dress while another team member checks a tablet tracking view",
  },
];

export function AtelierImageStrip() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.15fr 0.85fr" },
        gap: { xs: 2.5, md: 3 },
        mt: { xs: 4, md: 6 },
      }}
    >
      {imageStories.map((story, index) => (
        <Box
          key={story.title}
          sx={{
            position: "relative",
            minHeight:
              index === 0 ? { xs: 320, md: 500 } : { xs: 260, md: 240 },
            gridRow: index === 0 ? { md: "span 2" } : undefined,
            borderRadius: 1,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 30px 76px -54px rgba(21,17,26,0.62)",
            ...homeRiseSx(120 + index * 90),
          }}
        >
          <Box
            component="img"
            src={story.image}
            alt={story.alt}
            loading="lazy"
            decoding="async"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 700ms ease",
              ".MuiBox-root:hover > &": {
                transform: "scale(1.035)",
              },
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(21,17,26,0.02) 24%, rgba(21,17,26,0.7) 100%)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              p: { xs: 2.5, md: 3 },
              color: "common.white",
            }}
          >
            <Typography
              variant={index === 0 ? "h3" : "h5"}
              component="h3"
              // The first card uses the larger h3 on desktop; on mobile it must
              // match the sibling (h5) titles so all three read consistently.
              sx={
                index === 0
                  ? { fontSize: { xs: "1.125rem", md: "1.8rem" } }
                  : undefined
              }
            >
              {story.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 1, maxWidth: 520, color: "rgba(255,255,255,0.78)" }}
            >
              {story.body}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
