import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { tokens } from "../../theme";
import {
  AdminActionFeedback,
  AdminRoleDefinition,
  AdminPermissionDefinition,
  AdminRole,
} from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { MetricCard } from "../../components/ui/MetricCard";
import { isProtectedOwnerPermission, permissionDescription, permissionLabel, roleHasPermission, roleTone } from "./utils";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function RolePermissionsSection({
  roles,
  permissions,
  actionData,
}: {
  roles: AdminRoleDefinition[];
  permissions: AdminPermissionDefinition[];
  actionData?: AdminActionFeedback;
}) {
  const [detailRoleId, setDetailRoleId] = useState<AdminRole | null>(null);
  const [editRoleId, setEditRoleId] = useState<AdminRole | null>(null);
  const totalGrants = roles.reduce(
    (sum, role) => sum + role.permissions.length,
    0,
  );
  const ownerGrants =
    roles.find((role) => role.role === "owner")?.permissions.length ?? 0;
  const detailRole = roles.find((role) => role.role === detailRoleId) ?? null;
  const editRole = roles.find((role) => role.role === editRoleId) ?? null;
  const {
    page: rolePage,
    pageCount: rolePageCount,
    pagedItems: pagedRoles,
    setPage: setRolePage,
  } = usePagedItems(roles, 8, roles.length);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="RBAC"
        title="Role and permission management"
        helper="Tune the grants behind each admin role without changing operator accounts one by one."
      />

      {actionData?.section === "roles" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        }}
      >
        <MetricCard
          label="Managed roles"
          value={String(roles.length)}
          helper="Owner, operator, support"
          trend="Platform scoped"
        />
        <MetricCard
          label="Total grants"
          value={String(totalGrants)}
          helper="Across all roles"
          trend={`${permissions.length} available`}
        />
        <MetricCard
          label="Owner grants"
          value={String(ownerGrants)}
          helper="Recovery permissions locked"
          trend="Protected"
        />
      </Box>

      {roles.length === 0 ? (
        <Alert severity="warning">
          Role permissions could not be loaded from the admin API.
        </Alert>
      ) : (
        <Panel sx={{ overflow: "hidden" }}>
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                alignItems: { sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="h6">Roles</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {roles.length} roles configured. Open a role to inspect or
                  edit its grants.
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${totalGrants} total grants`}
                variant="outlined"
              />
            </Stack>
          </Box>
          <Divider />
          <Stack spacing={0}>
            {pagedRoles.map((role) => (
              <Box
                key={role.role}
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
                        onClick={() => setDetailRoleId(role.role)}
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
                        onClick={() => setEditRoleId(role.role)}
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
            ))}
          </Stack>
          <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2 }}>
            <PaginationFooter
              count={rolePageCount}
              label="roles"
              page={rolePage}
              pageSize={8}
              total={roles.length}
              onChange={setRolePage}
            />
          </Box>
        </Panel>
      )}

      <Dialog
        open={Boolean(detailRole)}
        onClose={() => setDetailRoleId(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="span"
                sx={{ display: "block", fontWeight: 950 }}
              >
                {detailRole?.label ?? "Role permissions"}
              </Typography>
              <Typography
                component="span"
                variant="body2"
                sx={{ display: "block", color: "text.secondary" }}
              >
                {detailRole?.permissions.length ?? 0} grants assigned.
              </Typography>
            </Box>
            <IconButton
              aria-label="Close"
              onClick={() => setDetailRoleId(null)}
            >
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            {detailRole?.permissions.map((permission) => (
              <Box
                key={permission}
                sx={{
                  p: 1.25,
                  borderRadius: 1.25,
                  border: "1px solid",
                  borderColor: alpha(roleTone(detailRole.role), 0.16),
                  bgcolor: alpha(roleTone(detailRole.role), 0.045),
                }}
              >
                <Typography sx={{ fontWeight: 900 }}>
                  {permissionLabel(permission)}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {permissionDescription(permission)}
                </Typography>
              </Box>
            ))}
            {detailRole?.permissions.length === 0 ? (
              <Alert severity="info">
                No permissions are assigned to this role.
              </Alert>
            ) : null}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ justifyContent: "flex-end", pt: 1 }}
            >
              <Button
                type="button"
                variant="outlined"
                onClick={() => setDetailRoleId(null)}
              >
                Close
              </Button>
              {detailRole ? (
                <Button
                  type="button"
                  variant="contained"
                  startIcon={<SettingsRounded />}
                  onClick={() => {
                    setEditRoleId(detailRole.role);
                    setDetailRoleId(null);
                  }}
                >
                  Edit permissions
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editRole)}
        onClose={() => setEditRoleId(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="span"
                sx={{ display: "block", fontWeight: 950 }}
              >
                Edit {editRole?.label ?? "role"} permissions
              </Typography>
              <Typography
                component="span"
                variant="body2"
                sx={{ display: "block", color: "text.secondary" }}
              >
                Grant only the capabilities this role should use.
              </Typography>
            </Box>
            <IconButton aria-label="Close" onClick={() => setEditRoleId(null)}>
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {editRole ? (
            <Form key={editRole.role} method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-role-permissions:update"
              />
              <input type="hidden" name="role" value={editRole.role} />
              <Stack spacing={2}>
                <Stack spacing={1}>
                  {permissions.map((permission) => {
                    const protectedPermission = isProtectedOwnerPermission(
                      editRole.role,
                      permission.permission,
                    );
                    const checked =
                      roleHasPermission(editRole, permission.permission) ||
                      protectedPermission;

                    return (
                      <Box
                        key={permission.permission}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.25,
                          border: "1px solid",
                          borderColor: checked
                            ? alpha(roleTone(editRole.role), 0.26)
                            : alpha(tokens.ink, 0.08),
                          bgcolor: checked
                            ? alpha(roleTone(editRole.role), 0.055)
                            : alpha(tokens.white, 0.54),
                        }}
                      >
                        {protectedPermission ? (
                          <input
                            type="hidden"
                            name="permissions"
                            value={permission.permission}
                          />
                        ) : null}
                        <FormControlLabel
                          sx={{
                            m: 0,
                            alignItems: "flex-start",
                            ".MuiFormControlLabel-label": { width: "100%" },
                          }}
                          control={
                            <Checkbox
                              name="permissions"
                              value={permission.permission}
                              defaultChecked={checked}
                              disabled={protectedPermission}
                              sx={{ pt: 0.2 }}
                            />
                          }
                          label={
                            <Box>
                              <Stack
                                direction="row"
                                spacing={0.75}
                                sx={{ alignItems: "center", flexWrap: "wrap" }}
                              >
                                <Typography sx={{ fontWeight: 900 }}>
                                  {permission.label}
                                </Typography>
                                {protectedPermission ? (
                                  <Chip
                                    size="small"
                                    label="Required"
                                    sx={{
                                      height: 22,
                                      bgcolor: alpha(tokens.burgundy, 0.1),
                                      color: tokens.burgundy,
                                      fontWeight: 900,
                                    }}
                                  />
                                ) : null}
                              </Stack>
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary" }}
                              >
                                {permissionDescription(permission.permission)}
                              </Typography>
                            </Box>
                          }
                        />
                      </Box>
                    );
                  })}
                </Stack>

                {editRole.role === "owner" ? (
                  <Alert severity="info">
                    Owner recovery permissions are locked so the platform can
                    always manage roles and operator access.
                  </Alert>
                ) : null}

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => setEditRoleId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<AdminPanelSettingsRounded />}
                  >
                    Save permissions
                  </Button>
                </Stack>
              </Stack>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
