import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { Design } from "../../lib/api";
import { tokens } from "../../theme";
import { PaginationFooter, usePagedItems } from "./pagination";
import { DesignCard } from "./design-card";

export function DesignGrid({
  designs,
  featuredFirst = false,
}: {
  designs: Design[];
  featuredFirst?: boolean;
}) {
  const {
    page: designPage,
    pageCount: designPageCount,
    pagedItems: pagedDesigns,
    setPage: setDesignPage,
  } = usePagedItems(designs, 12, `${featuredFirst}:${designs.length}`);

  if (designs.length === 0) {
    return (
      <Box
        sx={{
          py: 8,
          px: 2,
          textAlign: "center",
          border: "1px dashed",
          borderColor: alpha(tokens.burgundy, 0.28),
          borderRadius: "8px",
          bgcolor: "rgba(var(--surface-rgb), 0.58)",
        }}
      >
        <Typography variant="h6">No designs matched</Typography>
        <Typography sx={{ color: "text.secondary", mt: 0.75 }}>
          Try a different search, or check back when the store publishes more
          pieces.
        </Typography>
      </Box>
    );
  }
  return (
    <>
      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: {
            xs: "minmax(0, min(100%, 430px))",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(auto-fill, minmax(280px, 360px))",
          },
          justifyContent: { xs: "center", sm: "start" },
        }}
      >
        {pagedDesigns.map((design, index) => {
          const absoluteIndex = (designPage - 1) * 12 + index;
          return (
            <DesignCard
              key={design.design_id}
              design={design}
              index={absoluteIndex}
              featured={featuredFirst && absoluteIndex === 0}
            />
          );
        })}
      </Box>
      <PaginationFooter
        count={designPageCount}
        label="designs"
        page={designPage}
        pageSize={12}
        total={designs.length}
        onChange={setDesignPage}
      />
    </>
  );
}
