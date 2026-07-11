import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { tokens } from "../../theme";
import { BusinessUser, CurrentUser } from "../shared/types";
import { roleTone, businessUserInitials, roleLabel, businessUserJoinedLabel } from "../shared/utils";
import { ToneChip } from "../../components/ui/ToneChip";

export function BusinessUserRow({
  user,
  currentUser,
  onView,
}: {
  user: BusinessUser;
  currentUser: CurrentUser;
  onView: () => void;
}) {
  const isCurrentUser = user.business_user_id === currentUser.user_id;
  const tone = roleTone(user.role);

  return (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 1.6,
        borderTop: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: { xs: 1.5, md: 2 },
        transition: "background-color 160ms ease",
        "&:hover": {
          bgcolor: alpha(tokens.burgundy, 0.02),
        },
      }}
    >
      <Box
        sx={{
          width: { xs: 44, md: 50 },
          height: { xs: 44, md: 50 },
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          bgcolor: alpha(tone, 0.1),
          color: tone,
          fontWeight: 900,
          fontSize: { xs: "0.95rem", md: "1rem" },
          border: "1px solid",
          borderColor: alpha(tone, 0.18),
          boxShadow: `0 8px 20px ${alpha(tone, 0.08)}`,
        }}
      >
        {businessUserInitials(user)}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.6 }}
        >
          <Typography sx={{ fontWeight: 900 }} noWrap>
            {user.display_name || user.email}
          </Typography>
          <ToneChip label={roleLabel(user.role)} tone={tone} />
          <ToneChip
            label={user.is_active ? "Active" : "Inactive"}
            tone={user.is_active ? tokens.success : tokens.warning}
          />
          {isCurrentUser ? (
            <Chip size="small" variant="outlined" label="You" />
          ) : null}
        </Stack>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", overflowWrap: "anywhere", mt: 0.25 }}
        >
          {user.email}
        </Typography>
        {user.phone ? (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              overflowWrap: "anywhere",
              mt: 0.25,
            }}
          >
            {user.phone}
          </Typography>
        ) : null}
      </Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 0.5, md: 1.5 }}
        sx={{
          alignItems: { xs: "flex-end", md: "center" },
          flexShrink: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontWeight: 800,
            whiteSpace: "nowrap",
            textAlign: { xs: "right", md: "left" },
          }}
        >
          {businessUserJoinedLabel(user)}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<VisibilityRounded fontSize="small" />}
          onClick={onView}
          sx={{
            minWidth: 0,
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            fontWeight: 800,
            textTransform: "none",
          }}
        >
          View
        </Button>
      </Stack>
    </Box>
  );
}