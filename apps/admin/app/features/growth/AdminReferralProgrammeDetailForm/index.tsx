import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../../theme";
import type { AdminBusiness, AdminReferralProgramme } from "../../../lib/api";
import { ReferralProgrammeSummary } from "./ReferralProgrammeSummary";
import { ReferralCodesPanel } from "./ReferralCodesPanel";
import { ReferralProgrammeEditForm } from "./ReferralProgrammeEditForm";
import { ReferralProgrammeArchiveForm } from "./ReferralProgrammeArchiveForm";

export function AdminReferralProgrammeDetailForm({
  programme,
  eligibleBusinesses,
}: {
  programme: AdminReferralProgramme;
  eligibleBusinesses: AdminBusiness[];
}) {
  return (
    <Stack spacing={2}>
      <ReferralProgrammeSummary programme={programme} />
      {programme.notes ? (
        <Box
          sx={{
            p: 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.08),
            borderRadius: 1,
            bgcolor: "rgba(var(--surface-rgb), 0.7)",
          }}
        >
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Notes
          </Typography>
          <Typography sx={{ overflowWrap: "anywhere" }}>
            {programme.notes}
          </Typography>
        </Box>
      ) : null}
      <ReferralCodesPanel
        programme={programme}
        eligibleBusinesses={eligibleBusinesses}
      />
      <ReferralProgrammeEditForm programme={programme} />
      <ReferralProgrammeArchiveForm programme={programme} />
    </Stack>
  );
}
