import { useEffect, useMemo, useState } from "react";
import { ADMIN_PAGE_SIZE } from "./types";



export function usePagedItems<T>(
  items: T[],
  pageSize = ADMIN_PAGE_SIZE,
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
