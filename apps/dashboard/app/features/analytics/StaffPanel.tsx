import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import type { StaffActivityRow } from "./types";

// §14.1 "Staff/team analytics (performance & activity by staff member)" —
// Studio only. Uses the roles/seats Studio already has; orders and takings
// logged before staff attribution existed are unattributed (the API says so).
export function StaffPanel({ staff }: { staff: StaffActivityRow[] }) {
  return (
    <Panel id="analytics-staff">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <BadgeRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Team analytics</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Who created orders and logged takings across the window.
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {staff.length === 0 ? (
            <InlineEmptyState
              icon={<BadgeRounded sx={{ fontSize: 38 }} />}
              title="No team activity yet"
              helper="Add team members under Team — their orders and takings will scoreboard here."
            />
          ) : (
            staff.map((member) => (
              <Box
                key={member.user_id}
                sx={{
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.common.white, 0.03)
                      : alpha(theme.palette.common.black, 0.015),
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", minWidth: 0 }}
                >
                  <Typography
                    sx={{ fontWeight: 900, minWidth: 0, flex: 1 }}
                    noWrap
                  >
                    {member.display_name}
                  </Typography>
                  <ToneChip
                    label={member.role}
                    tone={member.role === "owner" ? tokens.gold : tokens.info}
                  />
                  {!member.is_active ? (
                    <ToneChip label="inactive" tone={tokens.mutedText} />
                  ) : null}
                </Stack>
                <Box
                  sx={{
                    mt: 1,
                    display: "grid",
                    gap: 1,
                    gridTemplateColumns: "repeat(3, 1fr)",
                  }}
                >
                  {[
                    { label: "Orders created", value: String(member.orders_created) },
                    { label: "Takings logged", value: String(member.takings_logged) },
                    {
                      label: "Takings value",
                      value: formatGHS(member.takings_minor),
                    },
                  ].map((stat) => (
                    <Box
                      key={stat.label}
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        textAlign: "center",
                        minWidth: 0,
                      }}
                    >
                      <Typography sx={{ fontWeight: 900 }} noWrap title={stat.value}>
                        {stat.value}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {stat.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))
          )}
        </Stack>
      </Box>
    </Panel>
  );
}
