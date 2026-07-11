import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LockResetRounded from "@mui/icons-material/LockResetRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { BusinessUser, CurrentUser } from "../shared/types";
import { roleTone, roleLabel, businessUserJoinedLabel, businessUserInitials } from "../shared/utils";
import { MiniStat } from "../../components/ui/MiniStat";
import { InfoStrip } from "../studio/InfoStrip";
import { businessUserRoleOptions } from "../shared/constants";

export function BusinessUserDetailForm({
  user,
  currentUser,
}: {
  user: BusinessUser;
  currentUser: CurrentUser;
}) {
  const isOwner = user.role === "owner";
  const isCurrentUser = user.business_user_id === currentUser.user_id;
  const tone = roleTone(user.role);

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        }}
      >
        <MiniStat
          icon={<PeopleAltRounded fontSize="small" />}
          label="Role"
          value={roleLabel(user.role)}
          helper={isCurrentUser ? "Current session" : "Business user"}
          tone={tone}
        />
        <MiniStat
          icon={<CheckCircleRounded fontSize="small" />}
          label="Status"
          value={user.is_active ? "Active" : "Inactive"}
          helper={businessUserJoinedLabel(user)}
          tone={user.is_active ? tokens.success : tokens.warning}
        />
        <MiniStat
          icon={<VerifiedUserRounded fontSize="small" />}
          label="Identity"
          value={businessUserInitials(user)}
          helper={user.email}
          tone={tokens.info}
        />
      </Box>

      {isOwner ? (
        <InfoStrip
          icon={<VerifiedUserRounded />}
          tone={tokens.burgundy}
          title="Protected owner account"
          helper="Owner role changes stay outside this team desk."
        />
      ) : (
        <Stack spacing={1.5}>
          <Form method="post">
            <input type="hidden" name="intent" value="update_business_user" />
            <input
              type="hidden"
              name="business_user_id"
              value={user.business_user_id}
            />
            <input
              type="hidden"
              name="is_active"
              value={user.is_active ? "true" : "false"}
            />
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "minmax(0, 1fr) 150px auto",
                },
                alignItems: "center",
              }}
            >
              <TextField
                name="display_name"
                label="Name"
                size="small"
                defaultValue={user.display_name}
                required
              />
              <TextField
                name="phone"
                label="Phone (for SMS alerts)"
                helperText="Used for order + account SMS notifications."
                size="small"
                defaultValue={user.phone}
              />
              <TextField
                name="role"
                label="Role"
                select
                size="small"
                defaultValue={user.role === "admin" ? "admin" : "staff"}
              >
                {businessUserRoleOptions.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveRounded />}
              >
                Save
              </Button>
            </Box>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="update_business_user" />
            <input
              type="hidden"
              name="business_user_id"
              value={user.business_user_id}
            />
            <input
              type="hidden"
              name="display_name"
              value={user.display_name}
            />
            <input type="hidden" name="phone" value={user.phone} />
            <input
              type="hidden"
              name="role"
              value={user.role === "admin" ? "admin" : "staff"}
            />
            <input
              type="hidden"
              name="is_active"
              value={user.is_active ? "false" : "true"}
            />
            <Button
              type="submit"
              variant="outlined"
              color={user.is_active ? "error" : "success"}
              disabled={isCurrentUser}
            >
              {user.is_active ? "Deactivate user" : "Reactivate user"}
            </Button>
          </Form>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="reset_business_user_password"
            />
            <input
              type="hidden"
              name="business_user_id"
              value={user.business_user_id}
            />
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) auto" },
              }}
            >
              <TextField
                name="password"
                label="New temporary password"
                type="password"
                size="small"
                required
                slotProps={{ htmlInput: { minLength: 8, maxLength: 72 } }}
              />
              <Button
                type="submit"
                variant="outlined"
                startIcon={<LockResetRounded />}
              >
                Reset password
              </Button>
            </Box>
          </Form>
        </Stack>
      )}
    </Stack>
  );
}