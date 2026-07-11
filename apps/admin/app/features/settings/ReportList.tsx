import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import { tokens } from "../../theme";
import { AdminReportItem, Section } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { ReportDetail } from "./ReportDetail";

export function ReportList({
  items,
  onSelect,
}: {
  items: AdminReportItem[];
  onSelect: (section: Section) => void;
}) {
  const {
    page,
    pageCount,
    pagedItems,
    setPage,
  } = usePagedItems(items, 7, items.length);

  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <ReceiptLongRounded sx={{ color: tokens.burgundy }} />
          <Box>
            <Typography variant="h6">Operational report</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Current posture by admin workflow.
            </Typography>
          </Box>
        </Stack>
        <Divider />
        <Stack spacing={1.25}>
          {pagedItems.map((item) => (
            <ReportDetail key={item.id} item={item} onSelect={onSelect} />
          ))}
        </Stack>
        <PaginationFooter
          count={pageCount}
          label="report rows"
          page={page}
          pageSize={7}
          total={items.length}
          onChange={setPage}
        />
      </Stack>
    </Panel>
  );
}
