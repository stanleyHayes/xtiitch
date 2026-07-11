import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type NavGroup } from "./nav-data";
import { MegaItem } from "./mega-menu";

export function MobileNav({
  onNavigate,
  groups,
}: {
  onNavigate: () => void;
  groups: NavGroup[];
}) {
  return (
    <>
      {groups.map((group) => (
        <Box key={group.label} sx={{ mb: 1.5 }}>
          <Typography
            sx={{
              px: 0.5,
              mb: 0.75,
              fontWeight: 800,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "text.secondary",
            }}
          >
            {group.label}
          </Typography>
          <Stack spacing={0.5}>
            {group.items.map((item, i) => (
              <MegaItem
                key={item.href}
                item={item}
                index={i}
                onNavigate={onNavigate}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </>
  );
}
