import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import DesignServicesRounded from "@mui/icons-material/DesignServicesRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import { ACTIVATION_PATH } from "../../lib/activation";
import { Panel } from "../../components/ui/Panel";
import { EmptyState } from "../../components/ui/EmptyState";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { MiniStat } from "../../components/ui/MiniStat";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import TextField from "../../components/form-text-field";
import { DesignCard } from "../studio/DesignCard";
import type {
  CollectionSummary,
  Design,
  Profile,
  SizeBand,
} from "../shared/types";
import { tokens } from "../../theme";

export function CatalogueDesignGrid({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  designs,
  collections,
  sizeBands,
  profile,
  filteredCatalogueDesigns,
  pagedCatalogueDesigns,
  cataloguePage,
  cataloguePageCount,
  setCataloguePage,
  designCollectionFilter,
  setDesignCollectionFilter,
  designTypeFilter,
  setDesignTypeFilter,
  setOpenDesignId,
  setCatalogueView,
  setCatalogueToolsOpen,
  publishedCollections,
  cataloguePriceCount,
  pendingActivation,
}: {
  designs: Design[];
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  profile: Profile;
  filteredCatalogueDesigns: Design[];
  pagedCatalogueDesigns: Design[];
  cataloguePage: number;
  cataloguePageCount: number;
  setCataloguePage: (page: number) => void;
  designCollectionFilter: string;
  setDesignCollectionFilter: (value: string) => void;
  designTypeFilter: "all" | "made_to_wear" | "bespoke";
  setDesignTypeFilter: (value: "all" | "made_to_wear" | "bespoke") => void;
  setOpenDesignId: (id: string | null) => void;
  setCatalogueView: (value: "all" | "add") => void;
  setCatalogueToolsOpen: (mode: "collections" | "sizeBands" | null) => void;
  publishedCollections: number;
  cataloguePriceCount: number;
  pendingActivation: boolean;
}) {
  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <MiniStat
          icon={<StorefrontRounded fontSize="small" />}
          label="Active pieces"
          value={String(
            designs.filter((design) => design.status === "active").length,
          )}
          helper={`${designs.length} total designs`}
          tone={tokens.success}
        />
        <MiniStat
          icon={<VisibilityRounded fontSize="small" />}
          label="Collections"
          value={String(publishedCollections)}
          helper={`${collections.length} total collections`}
          tone={tokens.info}
          action={
            <Button
              size="small"
              variant="outlined"
              onClick={() => setCatalogueToolsOpen("collections")}
            >
              All collections
            </Button>
          }
        />
        <MiniStat
          icon={<ContentCutRounded fontSize="small" />}
          label="Customisable"
          value={String(
            designs.filter((design) => design.customisation_allowed).length,
          )}
          helper="Available for bespoke requests"
          tone={tokens.burgundy}
        />
        <MiniStat
          icon={<StraightenRounded fontSize="small" />}
          label="Size bands"
          value={String(sizeBands.length)}
          helper={`${cataloguePriceCount} prices set`}
          tone={tokens.warning}
          action={
            <Button
              size="small"
              variant="outlined"
              onClick={() => setCatalogueToolsOpen("sizeBands")}
            >
              All size bands
            </Button>
          }
        />
      </Box>
      {designs.length === 0 ? (
        <Panel sx={{ mt: 2, p: { xs: 2.5, md: 3 } }}>
          <EmptyState
            icon={<DesignServicesRounded sx={{ fontSize: 38 }} />}
            title="No designs yet"
            helper="Add your first design with an uploaded image so customers can browse the store."
          />
          <Box
            sx={{
              mt: 2,
              display: "flex",
              justifyContent: "center",
            }}
          >
            {pendingActivation ? (
              // Same gate as the toolbar's "Add design": a paid plan pending
              // activation routes to activation instead of opening the form
              // (the API rejects the save with 402 anyway).
              <Tooltip title="Activate your plan to add designs">
                <Button
                  component={RouterLink}
                  to={ACTIVATION_PATH}
                  variant="contained"
                  startIcon={<LockRounded />}
                >
                  Add a design
                </Button>
              </Tooltip>
            ) : (
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                onClick={() => setCatalogueView("add")}
              >
                Add a design
              </Button>
            )}
          </Box>
        </Panel>
      ) : (
        <>
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
            <TextField
              select
              size="small"
              label="Collection"
              value={designCollectionFilter}
              onChange={(event) =>
                setDesignCollectionFilter(event.target.value)
              }
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">All collections</MenuItem>
              <MenuItem value="none">No collection</MenuItem>
              {collections
                .filter((collection) => collection.status === "active")
                .map((collection) => (
                  <MenuItem
                    key={collection.collection_id}
                    value={collection.collection_id}
                  >
                    {collection.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Type"
              value={designTypeFilter}
              onChange={(event) =>
                setDesignTypeFilter(
                  event.target.value as "all" | "made_to_wear" | "bespoke",
                )
              }
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="all">All types</MenuItem>
              <MenuItem value="made_to_wear">Made-to-wear</MenuItem>
              <MenuItem value="bespoke">Bespoke</MenuItem>
            </TextField>
            {designCollectionFilter !== "all" ||
            designTypeFilter !== "all" ? (
              <Button
                size="small"
                onClick={() => {
                  setDesignCollectionFilter("all");
                  setDesignTypeFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </Stack>
          {filteredCatalogueDesigns.length === 0 ? (
            <Box sx={{ mt: 2 }}>
              <InlineEmptyState
                icon={<DesignServicesRounded sx={{ fontSize: 34 }} />}
                title="No designs match"
                helper="Try a different collection or design type."
              />
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  mt: 2,
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(3, minmax(0, 1fr))",
                    xl: "repeat(4, minmax(0, 1fr))",
                  },
                }}
              >
                {pagedCatalogueDesigns.map((design) => (
                  <DesignCard
                    key={design.design_id}
                    design={design}
                    collections={collections}
                    storeHandle={profile.handle}
                    onOpen={() => setOpenDesignId(design.design_id)}
                  />
                ))}
              </Box>
              <PaginationFooter
                count={cataloguePageCount}
                label="designs"
                page={cataloguePage}
                total={filteredCatalogueDesigns.length}
                onChange={setCataloguePage}
              />
            </>
          )}
        </>
      )}
    </Box>
  );
}
