import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { formatGHS } from "../../../lib/format";
import { tokens } from "../../../theme";
import type { CollectionSummary } from "../../shared/types";
import type { Design } from "../../../lib/api";
import { ToneChip } from "../../../components/ui/ToneChip";

export function DesignRowStatus({
  design,
  collections,
  priceSummary,
}: {
  design: Design;
  collections: CollectionSummary[];
  priceSummary: string;
}) {
  const retired = design.status === "retired";
  const collectionName =
    collections.find(
      (collection) => collection.collection_id === design.collection_id,
    )?.name ?? "No collection";

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ mt: 0.85, alignItems: "center", flexWrap: "wrap" }}
    >
      <ToneChip
        label={design.status}
        tone={retired ? tokens.mutedText : tokens.success}
      />
      <Chip size="small" variant="outlined" label={collectionName} />
      <Chip size="small" variant="outlined" label={priceSummary} />
      {design.customisation_allowed ? (
        <Chip size="small" variant="outlined" label="Customisable" />
      ) : null}
      {design.customisation_allowed &&
      (design.bespoke_display_minor ?? 0) > 0 ? (
        <Chip
          size="small"
          variant="outlined"
          label={`From ${formatGHS(design.bespoke_display_minor ?? 0)}`}
        />
      ) : null}
    </Stack>
  );
}
