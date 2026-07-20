import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import { tokens } from "../../theme";
import {
  EXPORT_FORMAT_LABELS,
  analyticsLevel,
  exportFormats,
  planNameForLevel,
} from "../../lib/entitlements";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import type { Profile } from "../shared/types";

// §14.3/§14.4 report exports. Exactly the formats the plan's export_* matrix
// booleans switch on are offered (Free: none — view-only, the §14.2 upgrade
// reason); the files themselves come from the report-download resource route,
// which proxies the API with the owner's token and streams back the
// Content-Disposition attachment. §14.5: the export reads the same metrics as
// the dashboard, so a download never disagrees with what the owner sees here.
export function ExportsPanel({
  profile,
  customRange,
}: {
  profile: Profile;
  customRange: { from: string; to: string };
}) {
  const formats = exportFormats(profile.entitlements);
  const level = analyticsLevel(profile.entitlement_limits);
  // Studio's custom range rides the export links too (the API accepts from/to
  // on reports for Studio only — exactly the plans that can set one).
  const rangeSuffix =
    level >= 3 && (customRange.from || customRange.to)
      ? `&from=${encodeURIComponent(customRange.from)}&to=${encodeURIComponent(customRange.to)}`
      : "";
  const reports = [
    {
      kind: "financial",
      title: "Financial records",
      helper:
        "Paystack-settled income, fees and payouts — matches the Money Desk.",
    },
    {
      kind: "sales",
      title: "Sales report",
      helper: "Orders and revenue across the window.",
    },
    // §14.1 "Full report suite" is Growth+: financial, sales, customers,
    // designs and orders in one file.
    ...(level >= 2
      ? [
          {
            kind: "full",
            title: "Full report suite",
            helper:
              "Financial, sales, customers, designs and orders in one file.",
          },
        ]
      : []),
  ];

  return (
    <Panel id="analytics-exports">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <DownloadRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>
                Export financial records
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Downloadable reports built from the same figures you see here.
              </Typography>
            </Box>
          </Stack>
          {formats.length > 0 ? (
            <ToneChip
              label={`${formats.length} format${formats.length === 1 ? "" : "s"} available`}
              tone={tokens.info}
            />
          ) : null}
        </Stack>

        {formats.length === 0 ? (
          // §14.2 Free: "No charts, no breakdowns, no downloads — view only.
          // Enough to run, a clear reason to upgrade."
          <Box
            sx={{
              mt: 2,
              p: 1.75,
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Your financial history always stays viewable on the dashboard.
              Upgrade to {planNameForLevel(1)} to download it as CSV — useful
              for your records, tax, or a loan application.
            </Typography>
            <Button
              component="a"
              href="/onboarding/billing"
              size="small"
              variant="outlined"
              sx={{ mt: 1.25 }}
            >
              See plans
            </Button>
          </Box>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {reports.map((report) => (
              <Box
                key={report.kind}
                sx={{
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Typography sx={{ fontWeight: 900 }}>{report.title}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {report.helper}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                  {formats.map((format) => (
                    <Button
                      key={format}
                      component="a"
                      href={`/report-download?report=${report.kind}&format=${format}${rangeSuffix}`}
                      download
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadRounded />}
                    >
                      {EXPORT_FORMAT_LABELS[format]}
                    </Button>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Panel>
  );
}
