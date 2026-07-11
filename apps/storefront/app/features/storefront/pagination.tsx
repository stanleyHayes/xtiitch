import { useEffect, useMemo, useState } from "react";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export const STOREFRONT_PAGE_SIZE = 12;

export function usePagedItems<T>(
  items: T[],
  pageSize = STOREFRONT_PAGE_SIZE,
  resetKey: string | number = "",
) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, pageCount, pagedItems, setPage };
}

export function PaginationFooter({
  count,
  label,
  page,
  pageSize = STOREFRONT_PAGE_SIZE,
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
        mt: 2.5,
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
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
