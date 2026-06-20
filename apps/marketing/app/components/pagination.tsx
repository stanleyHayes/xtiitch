import { useEffect, useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

export function PaginatedGrid<T>({
  items,
  label,
  pageSize = 12,
  gridSx,
  renderItem,
}: {
  items: T[];
  label: string;
  pageSize?: number;
  gridSx?: SxProps<Theme>;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(items.length, page * pageSize);

  return (
    <>
      <Box sx={gridSx}>
        {pagedItems.map((item, index) =>
          renderItem(item, (page - 1) * pageSize + index),
        )}
      </Box>
      {items.length > pageSize ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          sx={{
            mt: 3,
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Showing {start}-{end} of {items.length} {label}
          </Typography>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_event, nextPage) => setPage(nextPage)}
            color="primary"
            size="small"
            sx={{
              "& .MuiPagination-ul": {
                justifyContent: { xs: "center", sm: "flex-end" },
              },
            }}
          />
        </Stack>
      ) : null}
    </>
  );
}
