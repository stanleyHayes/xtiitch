import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import AddRounded from "@mui/icons-material/AddRounded";
import TextField from "../../components/form-text-field";
import type { Design } from "../../lib/api";
import { CollectionSummary } from "../shared/types";
import { StyledDateTimeField } from "../../components/ui/StyledDateTimeField";

export function PromotionCreateForm({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  activeCollections,
  activeDesigns,
}: {
  activeCollections: CollectionSummary[];
  activeDesigns: Design[];
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="create_promotion" />
      <Stack spacing={1.5}>
        <TextField
          name="code"
          label="Code"
          defaultValue="WELCOME10"
          size="small"
          required
          fullWidth
        />
        <TextField name="title" label="Title" size="small" required fullWidth />
        <TextField
          name="description"
          label="Internal note"
          size="small"
          multiline
          minRows={2}
          fullWidth
        />
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="discount_type"
            label="Discount type"
            select
            defaultValue="percentage"
            size="small"
          >
            <MenuItem value="percentage">Percentage</MenuItem>
            <MenuItem value="fixed">Fixed amount</MenuItem>
          </TextField>
          <TextField
            name="status"
            label="Status"
            select
            defaultValue="active"
            size="small"
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="paused">Paused</MenuItem>
          </TextField>
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          }}
        >
          <TextField
            name="percentage_discount"
            label="Percent"
            size="small"
            defaultValue="10"
            slotProps={{ htmlInput: { inputMode: "decimal" } }}
          />
          <TextField
            name="fixed_discount_ghs"
            label="Fixed"
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { inputMode: "decimal" },
            }}
          />
          <TextField
            name="max_discount_ghs"
            label="Max"
            size="small"
            defaultValue="50"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { inputMode: "decimal" },
            }}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="scope"
            label="Applies to"
            select
            defaultValue="store"
            size="small"
          >
            <MenuItem value="store">Entire store</MenuItem>
            <MenuItem value="collection">Collection</MenuItem>
            <MenuItem value="design">Design</MenuItem>
          </TextField>
          <TextField
            name="min_spend_ghs"
            label="Min spend"
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { inputMode: "decimal" },
            }}
          />
        </Box>
        <TextField
          name="target_collection_id"
          label="Collection target"
          select
          defaultValue=""
          size="small"
        >
          <MenuItem value="">No collection target</MenuItem>
          {activeCollections.map((collection) => (
            <MenuItem
              key={collection.collection_id}
              value={collection.collection_id}
            >
              {collection.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="target_design_id"
          label="Design target"
          select
          defaultValue=""
          size="small"
        >
          <MenuItem value="">No design target</MenuItem>
          {activeDesigns.map((design) => (
            <MenuItem key={design.design_id} value={design.design_id}>
              {design.title}
            </MenuItem>
          ))}
        </TextField>
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="usage_limit_global"
            label="Total uses"
            type="number"
            size="small"
            slotProps={{ htmlInput: { min: 1 } }}
          />
          <TextField
            name="usage_limit_per_customer"
            label="Uses/customer"
            type="number"
            size="small"
            slotProps={{ htmlInput: { min: 1 } }}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <StyledDateTimeField name="starts_at" label="Starts" size="small" />
          <StyledDateTimeField name="ends_at" label="Ends" size="small" />
        </Box>
        <Button type="submit" variant="contained" startIcon={<AddRounded />}>
          Create promotion
        </Button>
      </Stack>
    </Form>
  );
}
