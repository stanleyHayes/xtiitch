import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { Panel } from "../../components/ui/Panel";
import { AdminRoleDefinition } from "../shared/types";
import { roleTone } from "./utils";



export function RolePermissionMatrix({ roles }: { roles: AdminRoleDefinition[] }) {
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Role summary</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Current roles at a glance. Open the Roles section to inspect or edit
            grants.
          </Typography>
        </Box>
        <Stack spacing={1.25}>
          {roles.map((role) => (
            <Box
              key={role.role}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: alpha(roleTone(role.role), 0.2),
                bgcolor: alpha(roleTone(role.role), 0.055),
              }}
            >
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }}>{role.label}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {role.role}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`${role.permissions.length} grants`}
                  sx={{
                    bgcolor: alpha(roleTone(role.role), 0.12),
                    color: roleTone(role.role),
                    fontWeight: 900,
                  }}
                />
              </Stack>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Panel>
  );
}
