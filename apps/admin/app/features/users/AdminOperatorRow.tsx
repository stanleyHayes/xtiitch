import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import { AdminUser } from "../shared/types";
import { roleTone } from "./utils";



export function AdminOperatorRow({
  user,
  currentUserId,
  onView,
}: {
  user: AdminUser;
  currentUserId: string;
  onView: () => void;
}) {
  const isSelf = user.adminUserId === currentUserId;

  return (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(roleTone(user.role), 0.12),
              color: roleTone(user.role),
              flexShrink: 0,
            }}
          >
            <ShieldRounded />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900 }} noWrap>
              {user.displayName}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
            >
              {user.email}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ flexWrap: "wrap", gap: 0.75, alignItems: "center" }}
        >
          <Chip
            size="small"
            label={user.role}
            sx={{
              textTransform: "capitalize",
              bgcolor: alpha(roleTone(user.role), 0.12),
              color: roleTone(user.role),
            }}
          />
          <Chip
            size="small"
            label={user.isActive ? "Active" : "Inactive"}
            color={user.isActive ? "success" : "default"}
            variant={user.isActive ? "filled" : "outlined"}
          />
          {isSelf ? <Chip size="small" label="You" /> : null}
          <Button
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardRounded />}
            onClick={onView}
          >
            View details
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
