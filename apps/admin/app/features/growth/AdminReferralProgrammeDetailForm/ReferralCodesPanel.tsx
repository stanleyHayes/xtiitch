import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../../components/form-text-field";
import { tokens } from "../../../theme";
import { shortTime } from "../../shared/dates";
import {
  referralCodeOwnerOptions,
  referralCodeStatusOptions,
} from "../options";
import type { AdminBusiness, AdminReferralProgramme } from "../../../lib/api";

export function ReferralCodesPanel({
  programme,
  eligibleBusinesses,
}: {
  programme: AdminReferralProgramme;
  eligibleBusinesses: AdminBusiness[];
}) {
  const archived = programme.status === "archived";

  return (
    <Box
      sx={{
        p: 1.25,
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        borderRadius: 1,
        bgcolor: "rgba(var(--surface-rgb), 0.74)",
      }}
    >
      <Stack spacing={1.25}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{
            alignItems: { sm: "center" },
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
              Issued codes
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {programme.codes.length
                ? `${programme.codes.length} recent code${
                    programme.codes.length === 1 ? "" : "s"
                  }`
                : "No codes issued"}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${programme.codes.reduce(
              (total, code) => total + code.referralCount,
              0,
            )} referrals`}
            variant="outlined"
          />
        </Stack>

        {programme.codes.length > 0 ? (
          <Stack spacing={0.75}>
            {programme.codes.map((code) => (
              <Box
                key={code.referralCodeId}
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
                  },
                  alignItems: "center",
                  p: 1,
                  borderRadius: 1,
                  bgcolor: alpha(tokens.ink, 0.035),
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontWeight: 900,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {code.code}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    {code.ownerLabel || "Platform"} ·{" "}
                    {shortTime(code.updatedAt)}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary" }}
                >
                  {code.referralCount} total · {code.qualifiedCount}{" "}
                  qualified
                </Typography>
                <Chip
                  size="small"
                  label={code.status}
                  sx={{
                    justifySelf: { sm: "end" },
                    bgcolor: alpha(
                      code.status === "active"
                        ? tokens.success
                        : tokens.warning,
                      0.12,
                    ),
                    color:
                      code.status === "active"
                        ? tokens.success
                        : tokens.warning,
                    fontWeight: 900,
                  }}
                />
              </Box>
            ))}
          </Stack>
        ) : null}

        <Divider />

        <Form method="post">
          <input
            type="hidden"
            name="intent"
            value="admin-referral-code:create"
          />
          <input
            type="hidden"
            name="programme_id"
            value={programme.programmeId}
          />
          <Box
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: {
                xs: "1fr",
                md: "1fr 1fr 1.2fr auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              select
              label="Owner"
              name="owner_type"
              size="small"
              defaultValue="platform"
              disabled={archived || programme.status !== "active"}
            >
              {referralCodeOwnerOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Business"
              name="business_id"
              size="small"
              defaultValue=""
              disabled={
                archived ||
                programme.status !== "active" ||
                eligibleBusinesses.length === 0
              }
            >
              <MenuItem value="">None</MenuItem>
              {eligibleBusinesses.map((business) => (
                <MenuItem key={business.id} value={business.id}>
                  {business.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Code"
              name="code"
              size="small"
              placeholder={`${programme.codePrefix}AMA`}
              required
              disabled={archived || programme.status !== "active"}
            />
            <TextField
              select
              label="Status"
              name="status"
              size="small"
              defaultValue="active"
              disabled={archived || programme.status !== "active"}
            >
              {referralCodeStatusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Button
            type="submit"
            variant="outlined"
            disabled={archived || programme.status !== "active"}
            sx={{ mt: 1.25 }}
          >
            Issue code
          </Button>
        </Form>
      </Stack>
    </Box>
  );
}
