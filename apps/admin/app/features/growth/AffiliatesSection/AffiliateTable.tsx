import { Form } from "react-router";
import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type {
  AdminAffiliate,
  AdminAffiliateAttribution,
} from "../../../lib/api";
import TextField from "../../../components/form-text-field";
import { Panel } from "../../../components/ui/Panel";
import { PaginationFooter } from "../../../components/ui/PaginationFooter";
import { FormGroupLabel } from "../../shared/FormGroupLabel";
import {
  affiliateCommissionOptions,
  affiliateEntityOptions,
  affiliatePayoutOptions,
  affiliateStatusOptions,
} from "../options";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { AffiliateDetail } from "./AffiliateDetail";

export function AffiliateTable({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  affiliates,
  pagedAffiliates,
  affiliateAttribution,
  page,
  pageCount,
  onPageChange,
  onSelect,
  affiliatesError,
}: {
  affiliates: AdminAffiliate[];
  pagedAffiliates: AdminAffiliate[];
  affiliateAttribution: AdminAffiliateAttribution[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onSelect: (affiliateId: string) => void;
  affiliatesError: string | null;
}) {
  const [affiliateDialogOpen, setAffiliateDialogOpen] = useState(false);
  const attributionByAffiliate = useMemo(
    () =>
      new Map(
        affiliateAttribution.map((item) => [item.affiliateId, item] as const),
      ),
    [affiliateAttribution],
  );

  return (
    <>
      {!affiliatesError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Register affiliate</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Add a partner code and the commercial terms operators approve.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => setAffiliateDialogOpen(true)}
            >
              New affiliate
            </Button>
          </Stack>
          <Dialog
            open={affiliateDialogOpen}
            onClose={() => setAffiliateDialogOpen(false)}
            fullWidth
            maxWidth="md"
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
                    Register affiliate partner
                  </Typography>
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{ display: "block", color: "text.secondary" }}
                  >
                    Add partner identity, commission terms, and payout details.
                  </Typography>
                </Box>
                <IconButton
                  aria-label="Close"
                  onClick={() => setAffiliateDialogOpen(false)}
                >
                  <CloseRounded />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="admin-affiliate:create"
                />
                <Stack spacing={2}>
                  <FormGroupLabel>Affiliate</FormGroupLabel>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                    }}
                  >
                    <TextField
                      select
                      label="Entity"
                      name="entity_type"
                      defaultValue="person"
                    >
                      {affiliateEntityOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Code"
                      name="code"
                      required
                      placeholder="SEWINGPRO"
                    />
                    <TextField
                      label="Display name"
                      name="display_name"
                      required
                    />
                    <TextField label="Contact name" name="contact_name" />
                    <TextField label="Email" name="email" type="email" />
                    <TextField label="Phone" name="phone" />
                    <TextField label="Website" name="website_url" type="url" />
                  </Box>
                  <FormGroupLabel>Commission &amp; payout</FormGroupLabel>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                    }}
                  >
                    <TextField
                      select
                      label="Commission"
                      name="commission_model"
                      defaultValue="percentage"
                    >
                      {affiliateCommissionOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Commission value"
                      name="commission_value"
                      type="number"
                      required
                      slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                    />
                    <TextField
                      label="Cookie window"
                      name="cookie_window_days"
                      type="number"
                      defaultValue={30}
                      slotProps={{ htmlInput: { min: 1, max: 365, step: 1 } }}
                    />
                    <TextField
                      select
                      label="Payout mode"
                      name="payout_mode"
                      defaultValue="voucher"
                    >
                      {affiliatePayoutOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Status"
                      name="status"
                      defaultValue="pending_review"
                    >
                      {affiliateStatusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    }}
                  >
                    <TextField
                      label="Payout reference"
                      name="payout_reference"
                    />
                    <TextField
                      label="Notes"
                      name="notes"
                      multiline
                      minRows={2}
                    />
                  </Box>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ justifyContent: "flex-end" }}
                  >
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => setAffiliateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="contained">
                      Create partner
                    </Button>
                  </Stack>
                </Stack>
              </Form>
            </DialogContent>
          </Dialog>
        </Panel>
      ) : null}

      {!affiliatesError && affiliates.length === 0 ? (
        <Alert severity="info">No affiliate partners are registered yet.</Alert>
      ) : null}

      {!affiliatesError && affiliates.length > 0 ? (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
            }}
          >
            {pagedAffiliates.map((affiliate) => (
              <AffiliateDetail
                key={affiliate.affiliateId}
                affiliate={affiliate}
                performance={attributionByAffiliate.get(affiliate.affiliateId)}
                onOpen={() => onSelect(affiliate.affiliateId)}
              />
            ))}
          </Box>
          <PaginationFooter
            count={pageCount}
            label="affiliate partners"
            page={page}
            pageSize={4}
            total={affiliates.length}
            onChange={onPageChange}
          />
        </>
      ) : null}
    </>
  );
}
