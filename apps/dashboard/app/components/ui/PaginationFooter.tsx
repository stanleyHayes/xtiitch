import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { DASHBOARD_PAGE_SIZE } from "../../features/shared/constants";

export function PaginationFooter({
  count,
  label,
  page,
  pageSize = DASHBOARD_PAGE_SIZE,
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
        px: { xs: 1, sm: 0 },
        pt: 1,
      }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Showing {start}-{end} of {total} {label}
      </Typography>
      <Pagination
        count={count}
        page={page}
        onChange={(_event, nextPage) => onChange(nextPage)}
        color="primary"
        size="small"
        sx={{
          "& .MuiPagination-ul": {
            justifyContent: { xs: "center", sm: "flex-end" },
          },
        }}
      />
    </Stack>
  );
}