import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import { Form } from "react-router";
import TextField from "../../components/form-text-field";
import type { Design } from "../../lib/api";
import type { CollectionSummary } from "../shared/types";
import type { BusinessAffiliateProgramme } from "./types";

export function ProgrammeForm({ // eslint-disable-line complexity -- one create/edit form derives safe defaults from an optional record
  programme,
}: {
  programme?: BusinessAffiliateProgramme;
}) {
  const editing = Boolean(programme);
  return (
    <Form method="post">
      <input
        type="hidden"
        name="intent"
        value={
          editing
            ? "update_affiliate_programme"
            : "create_affiliate_programme"
        }
      />
      {programme ? (
        <input
          type="hidden"
          name="affiliate_programme_id"
          value={programme.affiliate_programme_id}
        />
      ) : null}
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: {
            xs: "1fr",
            md: "2fr repeat(6, minmax(110px, 1fr)) auto",
          },
          alignItems: "center",
        }}
      >
        <TextField
          label="Programme name"
          name="name"
          defaultValue={programme?.name ?? ""}
          required
        />
        <TextField
          select
          label="Target"
          name="allowed_target_scope"
          defaultValue={programme?.allowed_target_scope ?? "store"}
        >
          <MenuItem value="store">Store</MenuItem>
          <MenuItem value="collection">Collection</MenuItem>
          <MenuItem value="design">Design</MenuItem>
          <MenuItem value="product">Product</MenuItem>
        </TextField>
        <TextField
          label="Purchase %"
          name="purchase_commission"
          type="number"
          defaultValue={
            (programme?.default_purchase_commission_bps ?? 1000) / 100
          }
        />
        <TextField
          label="Plan %"
          name="paid_plan_commission"
          type="number"
          defaultValue={
            (programme?.default_first_paid_plan_commission_bps ?? 0) / 100
          }
        />
        <TextField
          label="Cookie days"
          name="cookie_window_days"
          type="number"
          defaultValue={programme?.cookie_window_days ?? 30}
        />
        <TextField
          label="Hold days"
          name="hold_days"
          type="number"
          defaultValue={programme?.hold_days ?? 14}
        />
        <TextField
          label="Minimum GHS"
          name="minimum_payout"
          type="number"
          defaultValue={(programme?.minimum_payout_minor ?? 0) / 100}
        />
        <input
          type="hidden"
          name="description"
          value={programme?.description ?? ""}
        />
        <input
          type="hidden"
          name="status"
          value={programme?.status ?? "active"}
        />
        <input
          type="hidden"
          name="payout_mode"
          value={programme?.payout_mode ?? "manual"}
        />
        <Button type="submit" variant={editing ? "outlined" : "contained"}>
          {editing ? "Save" : "Create"}
        </Button>
      </Box>
    </Form>
  );
}

export function AffiliateCreateForm({
  programmes,
  collections,
  designs,
}: {
  programmes: BusinessAffiliateProgramme[];
  collections: CollectionSummary[];
  designs: Design[];
}) {
  const active = programmes.filter((item) => item.status === "active");
  const [programmeID, setProgrammeID] = useState(
    active[0]?.affiliate_programme_id ?? "",
  );
  const programme = active.find(
    (item) => item.affiliate_programme_id === programmeID,
  );
  const targetScope = programme?.allowed_target_scope ?? "store";
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="create_business_affiliate" />
      <input type="hidden" name="target_scope" value={targetScope} />
      <input type="hidden" name="status" value="active" />
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <TextField
          select
          label="Programme"
          name="affiliate_programme_id"
          value={programmeID}
          onChange={(event) => setProgrammeID(event.target.value)}
        >
          {active.map((item) => (
            <MenuItem
              key={item.affiliate_programme_id}
              value={item.affiliate_programme_id}
            >
              {item.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Code" name="code" required />
        <TextField label="Display name" name="display_name" required />
        <TextField label="Contact name" name="contact_name" />
        <TextField label="Email" name="email" type="email" />
        <TextField label="Phone" name="phone" />
        <TextField
          label="Purchase %"
          name="purchase_commission"
          type="number"
          defaultValue={(programme?.default_purchase_commission_bps ?? 0) / 100}
        />
        <TextField
          label="Plan %"
          name="paid_plan_commission"
          type="number"
          defaultValue={
            (programme?.default_first_paid_plan_commission_bps ?? 0) / 100
          }
        />
        <input
          type="hidden"
          name="cookie_window_days"
          value={programme?.cookie_window_days ?? 30}
        />
        {targetScope === "collection" ? (
          <TargetSelect
            name="target_ref_id"
            label="Collection"
            options={collections.map((item) => ({
              id: item.collection_id,
              label: item.name,
            }))}
          />
        ) : null}
        {targetScope === "design" || targetScope === "product" ? (
          <TargetSelect
            name="target_ref_id"
            label={targetScope === "product" ? "Product design" : "Design"}
            options={designs.map((item) => ({
              id: item.design_id,
              label: item.title,
            }))}
          />
        ) : null}
        <Button type="submit" variant="contained">
          Add affiliate
        </Button>
      </Box>
    </Form>
  );
}

function TargetSelect({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: { id: string; label: string }[];
}) {
  return (
    <TextField select required name={name} label={label} defaultValue="">
      {options.map((option) => (
        <MenuItem key={option.id} value={option.id}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
