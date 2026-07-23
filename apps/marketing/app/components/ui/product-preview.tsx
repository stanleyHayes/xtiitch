import type { SvgIconComponent } from "@mui/icons-material";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CircleIcon from "@mui/icons-material/Circle";
import { bespokeStages } from "../../content";
import { riseInSx, statusColour } from "./shared";

type JourneyStep = {
  label: string;
  value: string;
  title: string;
  body: string;
  href: string;
  accent: string;
  Icon: SvgIconComponent;
};

const journey: JourneyStep[] = [
  {
    label: "Public storefront",
    value: "Browse",
    title: "Share one beautiful storefront",
    body: "Customers discover designs, options and prices without digging through old chats.",
    href: "/discover",
    accent: "#800020",
    Icon: StorefrontRoundedIcon,
  },
  {
    label: "Order record",
    value: "Confirm",
    title: "Capture the whole order",
    body: "Selections, measurements, visits and payment arrive together in one clean record.",
    href: "/features",
    accent: "#b87914",
    Icon: ReceiptLongRoundedIcon,
  },
  {
    label: "Customer tracking",
    value: "Follow",
    title: "Make progress visible",
    body: "Every stage becomes a calm update customers can understand at a glance.",
    href: "/for-customers",
    accent: "#237a4b",
    Icon: ChecklistRoundedIcon,
  },
];

function JourneyCard({
  item,
  index,
}: {
  item: JourneyStep;
  index: number;
}) {
  const Icon = item.Icon;
  return (
    <Box
      sx={{
        position: "relative",
        zIndex: 1,
        display: "grid",
        gridTemplateColumns: {
          xs: "auto minmax(0,1fr)",
          sm: "auto minmax(0,1fr) auto",
        },
        gridTemplateAreas: {
          xs: '"icon content" "action action"',
          sm: '"icon content action"',
        },
        gap: { xs: 1.5, sm: 2 },
        alignItems: "center",
        p: { xs: 2, sm: 2.5 },
        width: "100%",
        minWidth: 0,
        overflow: "hidden",
        border: "1px solid",
        borderColor: index === 0 ? `${item.accent}38` : "divider",
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb),0.94)",
        boxShadow:
          index === 0
            ? "0 24px 56px -42px rgba(128,0,32,0.62)"
            : "0 16px 44px -42px rgba(21,17,26,0.5)",
        transition:
          "transform 190ms ease, border-color 190ms ease, box-shadow 190ms ease",
        ...riseInSx(160 + index * 90),
        "&:hover": {
          transform: "translateX(4px)",
          borderColor: `${item.accent}52`,
          boxShadow: `0 24px 56px -44px ${item.accent}`,
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          gridArea: "icon",
          width: { xs: 46, sm: 52 },
          height: { xs: 46, sm: 52 },
          borderRadius: 1.5,
          display: "grid",
          placeItems: "center",
          color: item.accent,
          bgcolor: `${item.accent}10`,
          border: "1px solid",
          borderColor: `${item.accent}28`,
        }}
      >
        <Icon fontSize="small" />
      </Box>
      <Box sx={{ gridArea: "content", minWidth: 0 }}>
        <Typography
          variant="overline"
          sx={{
            display: "block",
            color: item.accent,
            fontWeight: 850,
            letterSpacing: "0.09em",
            lineHeight: 1.2,
          }}
        >
          0{index + 1} · {item.label}
        </Typography>
        <Typography sx={{ mt: 0.65, fontWeight: 850, lineHeight: 1.25 }}>
          {item.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mt: 0.5,
            color: "text.secondary",
            display: { xs: "none", sm: "block" },
          }}
        >
          {item.body}
        </Typography>
      </Box>
      <Button
        component={RouterLink}
        to={item.href}
        variant="text"
        endIcon={<ArrowForwardRoundedIcon aria-hidden />}
        sx={{
          gridArea: "action",
          justifySelf: { xs: "end", sm: "stretch" },
          minWidth: "max-content",
          px: { xs: 1.5, sm: 1 },
          py: 0.75,
          color: item.accent,
          borderRadius: 999,
          fontWeight: 900,
          fontSize: { xs: 14, sm: 15 },
          lineHeight: 1,
          whiteSpace: "nowrap",
          "& .MuiButton-endIcon": {
            ml: 0.75,
            "& .MuiSvgIcon-root": { fontSize: 19 },
          },
          "&:hover": { bgcolor: `${item.accent}0d` },
        }}
      >
          {item.value}
      </Button>
    </Box>
  );
}

function CustomerStatusStrip() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "auto minmax(0,1fr)" },
        alignItems: "center",
        gap: 1.5,
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2,
        color: "common.white",
        bgcolor: "secondary.main",
        boxShadow: "0 24px 58px -46px rgba(21,17,26,0.78)",
      }}
    >
      <Box>
        <Typography
          variant="overline"
          sx={{ color: "rgba(255,255,255,0.58)", letterSpacing: "0.1em" }}
        >
          Live customer view
        </Typography>
        <Typography sx={{ fontWeight: 850 }}>One shared progress story</Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.75,
          justifyContent: { sm: "flex-end" },
        }}
      >
        {bespokeStages.slice(0, 3).map((stage, index) => (
          <Chip
            key={stage.label}
            size="small"
            color={statusColour[stage.colour]}
            label={stage.customerText}
            icon={<CircleIcon />}
            sx={{
              maxWidth: "100%",
              fontWeight: 800,
              opacity: index === 2 ? 0.72 : 1,
              "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

export function ProductPreview() {
  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 2.5, md: 3.5 },
        gridTemplateColumns: { xs: "1fr", lg: "0.84fr 1.16fr" },
        alignItems: "stretch",
        width: "100%",
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          position: "relative",
          minHeight: { xs: 390, md: 580 },
          overflow: "hidden",
          borderRadius: 3,
          border: "1px solid rgba(255,255,255,0.28)",
          boxShadow: "0 36px 90px -50px rgba(21,17,26,0.68)",
          ...riseInSx(80),
        }}
      >
        <Box
          component="img"
          src="/images/workflow-canvas.webp"
          alt="Fashion studio workflow arranged with fabric, patterns, measurements and an order phone"
          loading="lazy"
          decoding="async"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(21,17,26,0.04) 20%, rgba(21,17,26,0.9) 100%)",
          }}
        />
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            minHeight: "inherit",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            p: { xs: 2.5, sm: 3.5 },
            color: "common.white",
          }}
        >
          <Chip
            label="Storefront → studio floor"
            size="small"
            sx={{
              alignSelf: "flex-start",
              color: "common.white",
              bgcolor: "rgba(21,17,26,0.58)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          />
          <Box sx={{ maxWidth: 460 }}>
            <Typography
              variant="overline"
              sx={{ color: "rgba(255,255,255,0.66)", letterSpacing: "0.12em" }}
            >
              Everything stays connected
            </Typography>
            <Typography variant="h3" component="h3" sx={{ mt: 0.75 }}>
              A beautiful front door. A calmer business behind it.
            </Typography>
            <Typography sx={{ mt: 1.5, color: "rgba(255,255,255,0.74)" }}>
              The public store brings customers in. Xtiitch keeps the choices,
              payment and making journey moving after that.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          width: "100%",
          minWidth: 0,
        }}
      >
        <Box
          aria-label="Storefront to customer tracking journey"
          sx={{
            position: "relative",
            display: "grid",
            gap: 1.25,
            "&:before": {
              content: '""',
              position: "absolute",
              top: 50,
              bottom: 50,
              left: { xs: 44, sm: 49 },
              width: 2,
              bgcolor: "divider",
            },
          }}
        >
          {journey.map((item, index) => (
            <JourneyCard key={item.label} item={item} index={index} />
          ))}
        </Box>
        <CustomerStatusStrip />
      </Box>
    </Box>
  );
}
