import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TextField from "../../components/form-text-field";
import {
  AdminActionFeedback,
  AdminUser,
  AdminRoleDefinition,
} from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { MetricCard } from "../../components/ui/MetricCard";
import { RolePermissionMatrix } from "./RolePermissionMatrix";
import { AdminOperatorCreateForm } from "./AdminOperatorCreateForm";
import { AdminOperatorRow } from "./AdminOperatorRow";
import { AdminOperatorDetailForm } from "./AdminOperatorDetailForm";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function AdminUsersSection({
  users,
  roles,
  currentUserId,
  actionData,
  error,
}: {
  users: AdminUser[];
  roles: AdminRoleDefinition[];
  currentUserId: string;
  actionData?: AdminActionFeedback;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailID, setDetailID] = useState<string | null>(null);
  const activeCount = users.filter((user) => user.isActive).length;
  const ownerCount = users.filter((user) => user.role === "owner").length;
  const supportCount = users.filter((user) => user.role === "support").length;
  const filteredUsers = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? user.isActive : !user.isActive);
      const roleLabel =
        roles.find((role) => role.role === user.role)?.label ?? user.role;
      const searchable = [
        user.displayName,
        user.email,
        user.role,
        roleLabel,
        user.isActive ? "active" : "inactive",
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesRole &&
        matchesStatus &&
        (!normalisedQuery || searchable.includes(normalisedQuery))
      );
    });
  }, [query, roleFilter, roles, statusFilter, users]);
  const selectedUser =
    users.find((user) => user.adminUserId === detailID) ?? null;
  const {
    page: userPage,
    pageCount: userPageCount,
    pagedItems: pagedUsers,
    setPage: setUserPage,
  } = usePagedItems(filteredUsers, 8, `${query}:${roleFilter}:${statusFilter}`);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Access control"
        title="Operator user management"
        helper="Create platform operators, assign roles, and keep inactive access visible for review."
      />

      {actionData?.section === "users" && actionData.message ? (
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
          label="Active operators"
          value={String(activeCount)}
          helper="Can sign into admin"
          trend={`${users.length - activeCount} inactive`}
        />
        <MetricCard
          label="Owners"
          value={String(ownerCount)}
          helper="Can manage access"
          trend="Full grants"
        />
        <MetricCard
          label="Support"
          value={String(supportCount)}
          helper="Queue-focused access"
          trend="Scoped grants"
        />
      </Box>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", xl: "1.2fr 0.8fr" },
        }}
      >
        <Panel sx={{ overflow: "hidden" }}>
          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(220px, 1fr) repeat(2, minmax(140px, 0.35fr)) auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              label="Search operators"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Role"
              select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All roles</MenuItem>
              {roles.map((role) => (
                <MenuItem key={role.role} value={role.role}>
                  {role.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Status"
              select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            <Button
              variant="contained"
              startIcon={<PersonSearchRounded />}
              onClick={() => setCreateOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              New operator
            </Button>
          </Box>
          <Divider />
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
                <Typography sx={{ fontWeight: 900 }}>Operator list</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {filteredUsers.length} of {users.length} operators shown
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${users.length - activeCount} inactive`}
                color={users.length - activeCount > 0 ? "warning" : "success"}
                variant="outlined"
              />
            </Stack>
          </Box>
          {users.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <Alert severity="info">
                No operator accounts are available from the admin API.
              </Alert>
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <Alert severity="info">
                No operators match the current search and filters.
              </Alert>
            </Box>
          ) : (
            <>
              {pagedUsers.map((user) => (
                <AdminOperatorRow
                  key={user.adminUserId}
                  user={user}
                  currentUserId={currentUserId}
                  onView={() => setDetailID(user.adminUserId)}
                />
              ))}
              <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2 }}>
                <PaginationFooter
                  count={userPageCount}
                  label="operators"
                  page={userPage}
                  pageSize={8}
                  total={filteredUsers.length}
                  onChange={setUserPage}
                />
              </Box>
            </>
          )}
        </Panel>

        <RolePermissionMatrix roles={roles} />
      </Box>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create operator</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                New operators can sign in with the temporary password set here.
              </Typography>
            </Box>
            <IconButton onClick={() => setCreateOpen(false)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <AdminOperatorCreateForm roles={roles} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedUser)}
        onClose={() => setDetailID(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">
                {selectedUser?.displayName ?? "Operator details"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Update the operator profile, role, and access state.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedUser ? (
            <AdminOperatorDetailForm
              user={selectedUser}
              roles={roles}
              currentUserId={currentUserId}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
