import { useMemo } from "react";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { BusinessUser, CurrentUser } from "../shared/types";
import { useCloseOnSuccess } from "./useCloseOnSuccess";
import { businessUserJoinedLabel } from "../shared/utils";
import { usePagedItems } from "../shared/hooks";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { MiniStat } from "../../components/ui/MiniStat";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { BusinessUserRow } from "./BusinessUserRow";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { BusinessUserCreateForm } from "./BusinessUserCreateForm";
import { OwnerTransferPanel } from "./OwnerTransferPanel";
import { BusinessUserDetailForm } from "./BusinessUserDetailForm";

export function TeamPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  users,
  currentUser,
  error,
}: {
  users: BusinessUser[];
  currentUser: CurrentUser;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  useCloseOnSuccess(setCreateOpen, "create_business_user", Boolean(error));
  useCloseOnSuccess(setTransferOpen, "transfer_owner", Boolean(error));
  const [detailID, setDetailID] = useState<string | null>(null);
  const activeUsers = users.filter((user) => user.is_active).length;
  const adminUsers = users.filter((user) => user.role === "admin").length;
  const staffUsers = users.filter((user) => user.role === "staff").length;
  const inactiveUsers = users.filter((user) => !user.is_active).length;
  const filteredUsers = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? user.is_active : !user.is_active);
      const searchable = [
        user.display_name,
        user.email,
        user.role,
        user.is_active ? "active" : "inactive",
        businessUserJoinedLabel(user),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesRole &&
        matchesStatus &&
        (!normalisedQuery || searchable.includes(normalisedQuery))
      );
    });
  }, [query, roleFilter, statusFilter, users]);
  const {
    page: userPage,
    pageCount: userPageCount,
    pagedItems: pagedUsers,
    setPage: setUserPage,
  } = usePagedItems(filteredUsers, 8, `${query}:${roleFilter}:${statusFilter}`);
  const selectedUser =
    users.find((user) => user.business_user_id === detailID) ?? null;

  return (
    <Panel id="team">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <PeopleAltRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Team access</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Admins can manage the studio; staff can work assigned production
                desks.
              </Typography>
            </Box>
          </Stack>
          <ToneChip label={`${activeUsers} active`} tone={tokens.success} />
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          }}
        >
          <MiniStat
            icon={<CheckCircleRounded fontSize="small" />}
            label="Active"
            value={String(activeUsers)}
            helper={`${users.length} total accounts`}
            tone={tokens.success}
          />
          <MiniStat
            icon={<VerifiedUserRounded fontSize="small" />}
            label="Admins"
            value={String(adminUsers)}
            helper="Can manage workspace settings"
            tone={tokens.info}
          />
          <MiniStat
            icon={<PeopleAltRounded fontSize="small" />}
            label="Staff"
            value={String(staffUsers)}
            helper="Production desk access"
            tone={tokens.burgundy}
          />
          <MiniStat
            icon={<WarningAmberRounded fontSize="small" />}
            label="Inactive"
            value={String(inactiveUsers)}
            helper="Blocked from signing in"
            tone={tokens.warning}
          />
        </Box>

        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Box
          sx={{
            mt: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "rgba(var(--surface-rgb), 0.72)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              p: { xs: 2, md: 2.25 },
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(220px, 1fr) repeat(2, minmax(140px, 0.35fr)) auto auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              label="Search accounts"
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
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="staff">Staff</MenuItem>
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
              variant="outlined"
              startIcon={<VerifiedUserRounded />}
              onClick={() => setTransferOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              Transfer owner
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setCreateOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              New user
            </Button>
          </Box>
          <Divider />
          <Box
            sx={{
              p: { xs: 2, md: 2.25 },
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              alignItems: "center",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Account list</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {filteredUsers.length} of {users.length} people shown
              </Typography>
            </Box>
            <ToneChip
              label={`${inactiveUsers} inactive`}
              tone={inactiveUsers > 0 ? tokens.warning : tokens.success}
            />
          </Box>
          {users.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <InlineEmptyState
                icon={<PeopleAltRounded sx={{ fontSize: 38 }} />}
                title="No team accounts"
                helper="The owner account will appear here after the API returns business users."
              />
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <InlineEmptyState
                icon={<SearchRounded sx={{ fontSize: 38 }} />}
                title="No matching accounts"
                helper="Adjust the search or filters to bring more users back into view."
              />
            </Box>
          ) : (
            <>
              {pagedUsers.map((user) => (
                <BusinessUserRow
                  key={user.business_user_id}
                  user={user}
                  currentUser={currentUser}
                  onView={() => setDetailID(user.business_user_id)}
                />
              ))}
              <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
                <PaginationFooter
                  count={userPageCount}
                  label="team members"
                  page={userPage}
                  total={filteredUsers.length}
                  onChange={setUserPage}
                />
              </Box>
            </>
          )}
        </Box>
      </Box>
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create access</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Add an admin or staff sign-in.
              </Typography>
            </Box>
            <IconButton onClick={() => setCreateOpen(false)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <BusinessUserCreateForm error={error} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Owner transfer</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Move owner access to another active admin.
              </Typography>
            </Box>
            <IconButton
              onClick={() => setTransferOpen(false)}
              aria-label="Close"
            >
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <OwnerTransferPanel users={users} currentUser={currentUser} />
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
                {selectedUser?.display_name || selectedUser?.email || "Account"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Review access, role, status, and password controls.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedUser ? (
            <BusinessUserDetailForm
              user={selectedUser}
              currentUser={currentUser}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
