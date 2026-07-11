import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import DesignServicesRounded from "@mui/icons-material/DesignServicesRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import { ACTIVATION_PATH } from "../../lib/activation";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { ToneChip } from "../../components/ui/ToneChip";
import { Panel } from "../../components/ui/Panel";
import { DesignRow } from "../studio/DesignRow";
import { CatalogueAddDesign } from "./CatalogueAddDesign";
import { CatalogueDesignGrid } from "./CatalogueDesignGrid";
import type {
  CollectionSummary,
  DashboardActionData,
  Design,
  Profile,
  SizeBand,
} from "../shared/types";
import { tokens } from "../../theme";

export function CatalogueSection({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  designs,
  collections,
  sizeBands,
  profile,
  action,
  imageLimit,
  designLimit,
  atDesignLimit,
  catalogueView,
  setCatalogueView,
  openDesignId,
  setOpenDesignId,
  openCatalogueDesign,
  filteredCatalogueDesigns,
  pagedCatalogueDesigns,
  cataloguePage,
  cataloguePageCount,
  setCataloguePage,
  designCollectionFilter,
  setDesignCollectionFilter,
  designTypeFilter,
  setDesignTypeFilter,
  addCustomisation,
  setAddCustomisation,
  setDesignLimitDialogOpen,
  setCatalogueToolsOpen,
  publishedCollections,
  cataloguePriceCount,
  pendingActivation,
}: {
  designs: Design[];
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  profile: Profile;
  action: DashboardActionData;
  imageLimit: number;
  designLimit: number | null;
  atDesignLimit: boolean;
  catalogueView: "all" | "add";
  setCatalogueView: (value: "all" | "add") => void;
  openDesignId: string | null;
  setOpenDesignId: (id: string | null) => void;
  openCatalogueDesign: Design | null;
  filteredCatalogueDesigns: Design[];
  pagedCatalogueDesigns: Design[];
  cataloguePage: number;
  cataloguePageCount: number;
  setCataloguePage: (page: number) => void;
  designCollectionFilter: string;
  setDesignCollectionFilter: (value: string) => void;
  designTypeFilter: "all" | "made_to_wear" | "bespoke";
  setDesignTypeFilter: (value: "all" | "made_to_wear" | "bespoke") => void;
  addCustomisation: boolean;
  setAddCustomisation: (value: boolean) => void;
  setDesignLimitDialogOpen: (open: boolean) => void;
  setCatalogueToolsOpen: (mode: "collections" | "sizeBands" | null) => void;
  publishedCollections: number;
  cataloguePriceCount: number;
  pendingActivation: boolean;
}) {
  void openDesignId;
  return (
    <Box id="catalogue">
      <SectionHeader
        eyebrow="Catalogue"
        title="Design studio"
        helper="Add storefront designs, retire unavailable pieces, and keep product imagery tidy."
      />
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mt: 2,
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
        }}
      >
        <Button
          variant={
            !openCatalogueDesign && catalogueView === "all"
              ? "contained"
              : "outlined"
          }
          onClick={() => {
            setOpenDesignId(null);
            setCatalogueView("all");
          }}
          startIcon={<DesignServicesRounded />}
        >
          All designs ({designs.length})
        </Button>
        {pendingActivation ? (
          // Paid plan pending activation: route to the activation page instead
          // of opening the add-design form (the API would reject the save with
          // 402 anyway). Reads and the rest of the catalogue stay available.
          <Tooltip title="Activate your plan to add designs">
            <Button
              component={RouterLink}
              to={ACTIVATION_PATH}
              variant="outlined"
              startIcon={<LockRounded />}
            >
              Add design
            </Button>
          </Tooltip>
        ) : (
          <Tooltip
            title={
              atDesignLimit
                ? `You've reached the ${designLimit}-design limit on the Free plan`
                : ""
            }
          >
            <Button
              variant={
                !openCatalogueDesign && catalogueView === "add"
                  ? "contained"
                  : "outlined"
              }
              onClick={() => {
                if (atDesignLimit) {
                  setDesignLimitDialogOpen(true);
                  return;
                }
                setOpenDesignId(null);
                setCatalogueView("add");
              }}
              startIcon={atDesignLimit ? <LockRounded /> : <AddRounded />}
              sx={
                atDesignLimit
                  ? {
                      color: "text.disabled",
                      borderColor: "divider",
                    }
                  : undefined
              }
            >
              Add design
            </Button>
          </Tooltip>
        )}
        {openCatalogueDesign ? (
          <ToneChip
            label={`Editing: ${openCatalogueDesign.title}`}
            tone={tokens.burgundy}
          />
        ) : null}
      </Stack>

      {openCatalogueDesign ? (
        <Box sx={{ mt: 2 }}>
          <Button
            onClick={() => setOpenDesignId(null)}
            startIcon={<ArrowBackRounded />}
            sx={{ mb: 1.5 }}
          >
            All designs
          </Button>
          <Panel>
            <Box sx={{ p: { xs: 2, md: 2.5 }, pb: 1 }}>
              <Typography
                sx={{
                  fontFamily: '"Fraunces", serif',
                  fontSize: 22,
                  lineHeight: 1.15,
                }}
              >
                {openCatalogueDesign.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary" }}
              >
                Edit details, imagery, pricing, and availability for this piece.
              </Typography>
            </Box>
            <DesignRow
              key={openCatalogueDesign.design_id}
              design={openCatalogueDesign}
              collections={collections}
              sizeBands={sizeBands}
              storeHandle={profile.handle}
              defaultOpen
              priceError={action.priceError}
              imageLimit={imageLimit}
              isFreePlan={designLimit !== null}
            />
          </Panel>
        </Box>
      ) : catalogueView === "add" ? (
        <CatalogueAddDesign
          designs={designs}
          collections={collections}
          sizeBands={sizeBands}
          imageLimit={imageLimit}
          addCustomisation={addCustomisation}
          setAddCustomisation={setAddCustomisation}
          designError={action.designError}
          mediaError={action.mediaError}
        />
      ) : (
        <CatalogueDesignGrid
          designs={designs}
          collections={collections}
          sizeBands={sizeBands}
          profile={profile}
          filteredCatalogueDesigns={filteredCatalogueDesigns}
          pagedCatalogueDesigns={pagedCatalogueDesigns}
          cataloguePage={cataloguePage}
          cataloguePageCount={cataloguePageCount}
          setCataloguePage={setCataloguePage}
          designCollectionFilter={designCollectionFilter}
          setDesignCollectionFilter={setDesignCollectionFilter}
          designTypeFilter={designTypeFilter}
          setDesignTypeFilter={setDesignTypeFilter}
          setOpenDesignId={setOpenDesignId}
          setCatalogueView={setCatalogueView}
          setCatalogueToolsOpen={setCatalogueToolsOpen}
          publishedCollections={publishedCollections}
          cataloguePriceCount={cataloguePriceCount}
        />
      )}
    </Box>
  );
}
