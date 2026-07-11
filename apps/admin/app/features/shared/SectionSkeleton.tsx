import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";



// Shown while the loader is fetching a fresh dataset so the content area holds its
// shape instead of flashing empty or jumping when the new data lands.
export function SectionSkeleton() {
  return (
    <Stack spacing={2.5} aria-busy="true" aria-label="Loading section">
      <Stack spacing={0.75} sx={{ pl: 2 }}>
        <Skeleton variant="text" width={120} height={18} />
        <Skeleton variant="text" width={240} height={34} />
        <Skeleton variant="text" width={360} height={18} />
      </Stack>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            xl: "repeat(4, 1fr)",
          },
        }}
      >
        {[0, 1, 2, 3].map((key) => (
          <Skeleton
            key={key}
            variant="rounded"
            height={118}
            sx={{ borderRadius: 2 }}
          />
        ))}
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {[0, 1].map((key) => (
          <Skeleton
            key={key}
            variant="rounded"
            height={260}
            sx={{ borderRadius: 2 }}
          />
        ))}
      </Box>
    </Stack>
  );
}
