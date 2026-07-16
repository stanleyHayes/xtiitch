import { Form } from "react-router";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import BlockRounded from "@mui/icons-material/BlockRounded";
import CancelRounded from "@mui/icons-material/CancelRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import NotesRounded from "@mui/icons-material/NotesRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { AdminVerificationCase } from "../shared/types";
import { riskColor } from "../shared/colors";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { RiskChip } from "../shared/RiskChip";
import { StatusChip } from "../shared/StatusChip";

// One side of the submitted Ghana Card, captioned so the reviewer can tell front
// from back. Renders nothing when the URL is absent (submissions made before
// back-photo capture have no back image).
function GhanaCardPhoto({
  url,
  side,
}: Readonly<{ url: string; side: "Front" | "Back" }>) {
  if (!url) {
    return null;
  }
  return (
    <Box sx={{ flexShrink: 0 }}>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {side}
      </Typography>
      <Box
        component="a"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: "block" }}
      >
        <Box
          component="img"
          src={url}
          alt={`Ghana Card ${side.toLowerCase()}`}
          sx={{
            width: 180,
            height: 114,
            objectFit: "cover",
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.12),
          }}
        />
      </Box>
    </Box>
  );
}

export function VerificationCard({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  item,
  note,
  onNoteChange,
}: {
  item: AdminVerificationCase;
  note: string;
  onNoteChange: (id: string, value: string) => void;
}) {
  const accent = riskColor(item.riskLevel);
  const isHeld = item.status === "pending";
  const [expanded, setExpanded] = useState(false);

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        position: "relative",
        borderColor: alpha(accent, 0.2),
        backgroundImage: `
          linear-gradient(135deg, ${alpha(accent, 0.08)}, transparent 38%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(accent, 0.34),
          boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.1)}`,
        },
      }}
    >
      <Form method="post" style={{ display: "contents" }}>
        <input type="hidden" name="intent" value="admin-verification:decide" />
        <input type="hidden" name="business_id" value={item.id} />
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="h6">{item.businessName}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {item.handle}.xtiitch.com · {item.ownerName} · {item.ownerEmail}
              </Typography>
            </Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <RiskChip level={item.riskLevel} />
              <StatusChip status={item.status} />
              <Chip size="small" label={item.plan} variant="outlined" />
              <Button
                size="small"
                variant={expanded ? "outlined" : "contained"}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "Hide details" : "Review case"}
              </Button>
            </Stack>
          </Stack>
          <Collapse in={expanded} unmountOnExit>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Typography sx={{ color: "text.secondary" }}>
                {item.notes}
              </Typography>
              {item.idCardNumber || item.idPhotoURL || item.idPhotoBackURL ? (
                <Box
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: alpha(tokens.ink, 0.08),
                    borderRadius: 1.5,
                    bgcolor: "rgba(var(--surface-rgb), 0.62)",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Ghana Card
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{ alignItems: { sm: "center" } }}
                  >
                    {/* Both sides are captured at submission; the back is absent
                        on submissions that predate back-photo capture. */}
                    <GhanaCardPhoto url={item.idPhotoURL} side="Front" />
                    <GhanaCardPhoto url={item.idPhotoBackURL} side="Back" />
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        Card number
                      </Typography>
                      <Typography sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
                        {item.idCardNumber || "—"}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              ) : null}
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: alpha(tokens.ink, 0.08),
                    borderRadius: 1.5,
                    bgcolor: "rgba(var(--surface-rgb), 0.62)",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Documents
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: "wrap", gap: 1 }}
                  >
                    {item.documents.map((documentName) => (
                      <Chip
                        key={documentName}
                        size="small"
                        icon={<ReceiptLongRounded />}
                        label={documentName}
                      />
                    ))}
                  </Stack>
                </Box>
                <Box
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: alpha(tokens.ink, 0.08),
                    borderRadius: 1.5,
                    bgcolor: "rgba(var(--surface-rgb), 0.62)",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Checks
                  </Typography>
                  <Stack spacing={0.75}>
                    {item.checks.map((check) => (
                      <Stack
                        key={check}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <CheckCircleRounded
                          sx={{ color: tokens.success, fontSize: 18 }}
                        />
                        <Typography variant="body2">{check}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: alpha(tokens.ink, 0.08),
                    borderRadius: 1.5,
                    bgcolor: "rgba(var(--surface-rgb), 0.62)",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Evidence
                  </Typography>
                  <Stack spacing={0.75}>
                    {item.evidence.map((line) => (
                      <Stack
                        key={line}
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "flex-start" }}
                      >
                        <NotesRounded
                          sx={{ color: tokens.info, fontSize: 18, mt: 0.2 }}
                        />
                        <Typography variant="body2">{line}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
                <TextField
                  name="note"
                  label="Operator note"
                  value={note}
                  onChange={(event) =>
                    onNoteChange(item.id, event.target.value)
                  }
                  placeholder="Record why this case is approved, rejected, or held."
                  multiline
                  minRows={3}
                  fullWidth
                />
              </Box>
              <Divider />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Submitted {shortTime(item.submittedAt)}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    type="submit"
                    name="decision"
                    value="rejected"
                    variant="outlined"
                    color="error"
                    startIcon={<CancelRounded />}
                    disabled={item.status === "rejected"}
                  >
                    Reject
                  </Button>
                  <Button
                    type="submit"
                    name="decision"
                    value="held"
                    variant="outlined"
                    color="warning"
                    startIcon={<BlockRounded />}
                    disabled={isHeld}
                  >
                    Hold
                  </Button>
                  <Button
                    type="submit"
                    name="decision"
                    value="approved"
                    variant="contained"
                    startIcon={<CheckCircleRounded />}
                    disabled={item.status === "verified"}
                  >
                    Approve
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </Collapse>
        </Stack>
      </Form>
    </Panel>
  );
}
