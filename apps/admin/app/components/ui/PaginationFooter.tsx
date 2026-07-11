import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ADMIN_PAGE_SIZE } from "../../features/shared/types";



export function PaginationFooter({
  count,
  label,
  page,
  pageSize = ADMIN_PAGE_SIZE,
  total,
  onChange,
}: {
  count: number;
  label: string;
  page: number;
  pageSize?: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= pageSize) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.25}
      sx={{
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
        pt: 1,
      }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Showing {start}-{end} of {total} {label}
      </Typography>
      <Pagination
        count={count}
        page={page}
        onChange={(_event, value) => onChange(value)}
        color="primary"
        shape="rounded"
        size="small"
      />
    </Stack>
  );
}
