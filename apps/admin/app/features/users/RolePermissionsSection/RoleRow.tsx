import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { tokens } from "../../../theme";
import { AdminRoleDefinition } from "../../shared/types";
import { roleTone } from "../utils";

export function RoleRow({
  role,
  onView,
  onEdit,
}: {
  role: AdminRoleDefinition;
  onView: () => void;
  onEdit: () => void;
}) {
  return (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
        "&:first-of-type": { borderTop: 0 },
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
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center" }}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(roleTone(role.role), 0.12),
              color: roleTone(role.role),
              flexShrink: 0,
            }}
          >
            <AdminPanelSettingsRounded />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900 }} noWrap>
              {role.label}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary" }}
            >
              {role.role}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: "center",
            justifyContent: { xs: "flex-start", md: "flex-end" },
            flexWrap: "wrap",
          }}
        >
          <Chip
            size="small"
            label={`${role.permissions.length} grants`}
            sx={{
              bgcolor: alpha(roleTone(role.role), 0.12),
              color: roleTone(role.role),
              fontWeight: 900,
            }}
          />
          <Tooltip title="View permissions">
            <IconButton
              aria-label={`View permissions for ${role.label}`}
              onClick={onView}
              sx={{
                border: "1px solid",
                borderColor: alpha(roleTone(role.role), 0.18),
                bgcolor: alpha(roleTone(role.role), 0.05),
              }}
            >
              <VisibilityRounded />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit permissions">
            <IconButton
              aria-label={`Edit permissions for ${role.label}`}
              onClick={onEdit}
              sx={{
                border: "1px solid",
                borderColor: alpha(tokens.burgundy, 0.18),
                bgcolor: alpha(tokens.burgundy, 0.05),
              }}
            >
              <SettingsRounded />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}
