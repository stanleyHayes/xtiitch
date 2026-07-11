import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import { Link as RouterLink } from "react-router";
import { CatalogueSetupPanel } from "../settings/CatalogueSetupPanel";
import type { CollectionSummary, SizeBand } from "../shared/types";

export function DashboardDialogs({
  designLimit,
  designLimitDialogOpen,
  setDesignLimitDialogOpen,
  catalogueToolsOpen,
  setCatalogueToolsOpen,
  collections,
  sizeBands,
  storeHandle,
  collectionError,
  sizeBandError,
}: {
  designLimit: number | null;
  designLimitDialogOpen: boolean;
  setDesignLimitDialogOpen: (open: boolean) => void;
  catalogueToolsOpen: "collections" | "sizeBands" | null;
  setCatalogueToolsOpen: (mode: "collections" | "sizeBands" | null) => void;
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  storeHandle: string;
  collectionError?: string;
  sizeBandError?: string;
}) {
  return (
    <>
      <Dialog
        open={designLimitDialogOpen}
        onClose={() => setDesignLimitDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Design limit reached</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: "text.secondary" }}>
            You&apos;ve added the maximum {designLimit} designs allowed on the
            Free plan. Upgrade to a paid plan to publish more designs.
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: "flex-end" }}
          >
            <Button onClick={() => setDesignLimitDialogOpen(false)}>
              Not now
            </Button>
            <Button
              component={RouterLink}
              to="/onboarding/billing"
              variant="contained"
              startIcon={<TrendingUpRounded />}
            >
              Upgrade plan
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      <Dialog
        open={catalogueToolsOpen !== null}
        onClose={() => setCatalogueToolsOpen(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="span"
                sx={{ display: "block", fontWeight: 950 }}
              >
                {catalogueToolsOpen === "sizeBands"
                  ? "Manage size bands"
                  : "Manage collections"}
              </Typography>
              <Typography
                component="span"
                variant="body2"
                sx={{ display: "block", color: "text.secondary" }}
              >
                Add, edit, retire, delete, and keep catalogue ordering clean.
              </Typography>
            </Box>
            <IconButton
              aria-label="Close catalogue tools"
              onClick={() => setCatalogueToolsOpen(null)}
            >
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <CatalogueSetupPanel
            mode={catalogueToolsOpen}
            collections={collections}
            sizeBands={sizeBands}
            storeHandle={storeHandle}
            collectionError={collectionError}
            sizeBandError={sizeBandError}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
