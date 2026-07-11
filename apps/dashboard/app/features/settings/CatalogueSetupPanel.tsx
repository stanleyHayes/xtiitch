import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import TextField from "../../components/form-text-field";
import { CollectionSummary, SizeBand } from "../shared/types";
import { usePagedItems } from "../shared/hooks";
import { Panel } from "../../components/ui/Panel";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { CopyLinkButton } from "../studio/CopyLinkButton";
import { CollectionEditButton } from "./CollectionEditButton";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { SizeBandEditButton } from "./SizeBandEditButton";
import { SizeBandDeleteButton } from "./SizeBandDeleteButton";

export function CatalogueSetupPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  mode,
  collections,
  sizeBands,
  storeHandle,
  collectionError,
  sizeBandError,
}: {
  mode: "collections" | "sizeBands" | null;
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  storeHandle: string;
  collectionError?: string;
  sizeBandError?: string;
}) {
  const nextCollectionSequence =
    collections.length === 0
      ? 1
      : Math.max(...collections.map((collection) => collection.sequence)) + 1;
  const nextSizeBandSequence =
    sizeBands.length === 0
      ? 1
      : Math.max(...sizeBands.map((band) => band.sequence)) + 1;
  const {
    page: collectionPage,
    pageCount: collectionPageCount,
    pagedItems: pagedCollections,
    setPage: setCollectionPage,
  } = usePagedItems(collections, 6, collections.length);
  const {
    page: sizeBandPage,
    pageCount: sizeBandPageCount,
    pagedItems: pagedSizeBands,
    setPage: setSizeBandPage,
  } = usePagedItems(sizeBands, 12, sizeBands.length);

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: "1fr",
      }}
    >
      {mode === "collections" ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <StorefrontRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Collections</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Group pieces for the public store.
              </Typography>
            </Box>
          </Stack>
          {collectionError ? (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {collectionError}
            </Alert>
          ) : null}
          {/* Re-key on the collection count so the inputs clear after an add. */}
          <Form method="post" key={collections.length}>
            <input type="hidden" name="intent" value="create_collection" />
            <Box
              sx={{
                mt: 1.5,
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 96px" },
              }}
            >
              <TextField
                name="name"
                label="Collection name"
                size="small"
                required
              />
              <TextField
                name="sequence"
                label="Order"
                type="number"
                size="small"
                defaultValue={nextCollectionSequence}
                slotProps={{ htmlInput: { min: 0 } }}
                required
              />
            </Box>
            <TextField
              name="theme"
              label="Theme"
              size="small"
              fullWidth
              sx={{ mt: 1 }}
              placeholder="Wedding, Friday wear, Ready now"
            />
            <Button
              type="submit"
              variant="outlined"
              startIcon={<AddRounded />}
              sx={{ mt: 1.25 }}
            >
              Add collection
            </Button>
          </Form>
          <Divider sx={{ my: 1.75 }} />
          <Stack spacing={1}>
            {collections.length === 0 ? (
              <InlineEmptyState
                icon={<StorefrontRounded sx={{ fontSize: 34 }} />}
                title="No collections yet"
                helper="Collections help customers browse by occasion or drop."
              />
            ) : (
              pagedCollections.map((collection) => (
                <Stack
                  key={collection.collection_id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{
                    p: 1.25,
                    alignItems: { xs: "stretch", sm: "center" },
                    justifyContent: "space-between",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    bgcolor: "rgba(var(--surface-rgb), 0.72)",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {collection.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {collection.theme || collection.handle} · #
                      {collection.sequence}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center" }}
                  >
                    <CopyLinkButton
                      url={`https://${storeHandle}.xtiitch.com/collection/${collection.handle}`}
                      label="Copy collection link"
                    />
                    <CollectionEditButton
                      collection={collection}
                      error={collectionError}
                    />
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value={
                          collection.status === "active"
                            ? "retire_collection"
                            : "restore_collection"
                        }
                      />
                      <input
                        type="hidden"
                        name="collection_id"
                        value={collection.collection_id}
                      />
                      <Button type="submit" size="small" variant="outlined">
                        {collection.status === "active" ? "Retire" : "Restore"}
                      </Button>
                    </Form>
                    {collection.status !== "active" ? (
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="delete_collection"
                        />
                        <input
                          type="hidden"
                          name="collection_id"
                          value={collection.collection_id}
                        />
                        <Tooltip title="Remove collection">
                          <IconButton
                            type="submit"
                            color="error"
                            aria-label={`Remove ${collection.name}`}
                          >
                            <DeleteOutlineRounded />
                          </IconButton>
                        </Tooltip>
                      </Form>
                    ) : null}
                  </Stack>
                </Stack>
              ))
            )}
            <PaginationFooter
              count={collectionPageCount}
              label="collections"
              page={collectionPage}
              pageSize={6}
              total={collections.length}
              onChange={setCollectionPage}
            />
          </Stack>
        </Panel>
      ) : null}

      {mode === "sizeBands" ? (
        <Panel
          sx={{
            p: { xs: 2, md: 2.5 },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <StraightenRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Size bands</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Sizes become price rows for standard checkout.
              </Typography>
            </Box>
          </Stack>
          {sizeBandError ? (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {sizeBandError}
            </Alert>
          ) : null}
          {/* Re-key on the size-band count so the inputs clear after an add. */}
          <Form method="post" key={sizeBands.length}>
            <input type="hidden" name="intent" value="create_size_band" />
            <Box
              sx={{
                mt: 1.5,
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 96px" },
              }}
            >
              <TextField
                name="label"
                label="Size label"
                size="small"
                placeholder="M, L, XL, Custom"
                required
              />
              <TextField
                name="sequence"
                label="Order"
                type="number"
                size="small"
                defaultValue={nextSizeBandSequence}
                slotProps={{ htmlInput: { min: 0 } }}
                required
              />
            </Box>
            <Button
              type="submit"
              variant="outlined"
              startIcon={<AddRounded />}
              sx={{ mt: 1.25 }}
            >
              Add size band
            </Button>
          </Form>
          <Divider
            sx={{ mt: sizeBands.length === 0 ? "auto" : 1.75, mb: 1.75 }}
          />
          {sizeBands.length === 0 ? (
            <InlineEmptyState
              icon={<StraightenRounded sx={{ fontSize: 34 }} />}
              title="No size bands yet"
              helper="Add sizes before setting per-design prices."
            />
          ) : (
            <Stack spacing={1}>
              {pagedSizeBands.map((band) => {
                const chartCount = band.chart?.length ?? 0;
                return (
                  <Stack
                    key={band.size_band_id}
                    direction="row"
                    spacing={1}
                    sx={{
                      p: 1,
                      alignItems: "center",
                      justifyContent: "space-between",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      bgcolor: "rgba(var(--surface-rgb), 0.72)",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800 }} noWrap>
                        {band.label} · #{band.sequence}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {chartCount === 0
                          ? "No size chart"
                          : `${chartCount} measurement${chartCount === 1 ? "" : "s"}`}
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ alignItems: "center" }}
                    >
                      <SizeBandEditButton band={band} error={sizeBandError} />
                      <SizeBandDeleteButton band={band} />
                    </Stack>
                  </Stack>
                );
              })}
              <PaginationFooter
                count={sizeBandPageCount}
                label="size bands"
                page={sizeBandPage}
                pageSize={12}
                total={sizeBands.length}
                onChange={setSizeBandPage}
              />
            </Stack>
          )}
        </Panel>
      ) : null}
    </Box>
  );
}
