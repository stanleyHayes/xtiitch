import { useState } from "react";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { SectionHeader, Panel, PaginationFooter } from "../../components/ui";
import { usePagedItems } from "../shared/usePagedItems";
import { AdminVerificationCase, AdminActionFeedback } from "../shared/types";
import { VerificationCard } from "./VerificationCard";

export function VerificationsSection({
  verificationCases,
  verificationQueueError,
  actionData,
}: {
  verificationCases: AdminVerificationCase[];
  verificationQueueError: string | null;
  actionData?: AdminActionFeedback;
}) {
  const [verificationNotes, setVerificationNotes] = useState<
    Record<string, string>
  >({});
  const {
    page: verificationPage,
    pageCount: verificationPageCount,
    pagedItems: pagedVerificationCases,
    setPage: setVerificationPage,
  } = usePagedItems(verificationCases, 6, verificationCases.length);

  const updateVerificationNote = (id: string, value: string) => {
    setVerificationNotes((current) => ({ ...current, [id]: value }));
  };

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="KYC and business review"
        title="Payment verification queue"
        helper="Approve only when business identity, settlement account, and operator notes are clean."
      />
      {actionData?.section === "verification" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {verificationQueueError ? (
        <Alert severity="warning">{verificationQueueError}</Alert>
      ) : null}
      {verificationCases.length === 0 && !verificationQueueError ? (
        <Panel sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={1}>
            <Typography variant="h6">No verification cases</Typography>
            <Typography sx={{ color: "text.secondary" }}>
              New businesses will appear here as soon as they need an operator
              decision.
            </Typography>
          </Stack>
        </Panel>
      ) : null}
      {pagedVerificationCases.map((item) => (
        <VerificationCard
          key={item.id}
          item={item}
          note={verificationNotes[item.id] ?? ""}
          onNoteChange={updateVerificationNote}
        />
      ))}
      <PaginationFooter
        count={verificationPageCount}
        label="verification cases"
        page={verificationPage}
        pageSize={6}
        total={verificationCases.length}
        onChange={setVerificationPage}
      />
    </Stack>
  );
}
