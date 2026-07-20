import { Form } from "react-router";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CampaignRounded from "@mui/icons-material/CampaignRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import type { AdminAdCampaign, AdminBusiness } from "../../../lib/api";
import TextField from "../../../components/form-text-field";
import { Panel } from "../../../components/ui/Panel";
import { PaginationFooter } from "../../../components/ui/PaginationFooter";
import { FormGroupLabel } from "../../shared/FormGroupLabel";
import { useActionSuccess } from "../../shared/useActionSuccess";
import { StyledDateTimeField } from "../../shared/StyledDateTimeField";
import { adCampaignStatusOptions, adPlacementOptions } from "../options";
import { AdCampaignDetail } from "./AdCampaignDetail";

export function AdCampaignTable({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  campaigns,
  pagedCampaigns,
  businesses,
  page,
  pageCount,
  onPageChange,
  onSelect,
  adCampaignsError,
}: {
  campaigns: AdminAdCampaign[];
  pagedCampaigns: AdminAdCampaign[];
  businesses: AdminBusiness[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onSelect: (campaignId: string) => void;
  adCampaignsError: string | null;
}) {
  const [adDialogOpen, setAdDialogOpen] = useState(false);

  // §1.2/§11.4: the create panel closes on a successful submit; the
  // Collapse unmounts the form, so the next open starts cleared.
  const actionSuccess = useActionSuccess("ads");
  useEffect(() => {
    if (actionSuccess) {
      setAdDialogOpen(false);
    }
  }, [actionSuccess]);

  const eligibleBusinesses = businesses.filter(
    (business) =>
      business.verificationStatus === "verified" &&
      business.operationalStatus === "active",
  );

  return (
    <>
      {!adCampaignsError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create placement</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Only verified active businesses can be selected.
              </Typography>
            </Box>
            <Button
              variant={adDialogOpen ? "outlined" : "contained"}
              startIcon={<CampaignRounded />}
              endIcon={
                <KeyboardArrowDownRounded
                  sx={{
                    transition: "transform 0.2s ease",
                    transform: adDialogOpen ? "rotate(180deg)" : "none",
                  }}
                />
              }
              disabled={eligibleBusinesses.length === 0}
              onClick={() => setAdDialogOpen((open) => !open)}
              aria-expanded={adDialogOpen}
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            >
              {adDialogOpen ? "Close form" : "New placement"}
            </Button>
          </Stack>
          {eligibleBusinesses.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              No verified active businesses are eligible for sponsored placement
              yet.
            </Alert>
          ) : null}
          <Collapse in={adDialogOpen} unmountOnExit>
            <Box
              sx={{
                mt: 2,
                pt: 2,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 950 }}>
                  Create ad placement
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Set the business, placement, budget, and review note.
                </Typography>
              </Box>
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="admin-ad-campaign:create"
                />
                <input type="hidden" name="pricing_model" value="flat_time" />
                <Stack spacing={2}>
                  <FormGroupLabel>Campaign</FormGroupLabel>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, minmax(0, 1fr))",
                        xl: "1.2fr 1fr 1fr 1fr",
                      },
                    }}
                  >
                    <TextField
                      select
                      label="Business"
                      name="business_id"
                      size="small"
                      required
                      disabled={eligibleBusinesses.length === 0}
                      defaultValue={eligibleBusinesses[0]?.id ?? ""}
                    >
                      {eligibleBusinesses.map((business) => (
                        <MenuItem key={business.id} value={business.id}>
                          {business.name} · {business.handle}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Placement"
                      name="placement_type"
                      size="small"
                      defaultValue="featured_business"
                    >
                      {adPlacementOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Target ref"
                      name="target_ref_id"
                      size="small"
                      placeholder="Design ID when promoted design"
                    />
                    <TextField
                      select
                      label="Status"
                      name="status"
                      size="small"
                      defaultValue="pending_review"
                    >
                      {adCampaignStatusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Headline"
                      name="headline"
                      size="small"
                      required
                    />
                  </Box>
                  <FormGroupLabel>Budget &amp; schedule</FormGroupLabel>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        xl: "repeat(4, minmax(0, 1fr))",
                      },
                    }}
                  >
                    <TextField
                      label="Budget"
                      name="budget_ghs"
                      type="number"
                      size="small"
                      defaultValue="0.00"
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              GHS
                            </InputAdornment>
                          ),
                        },
                        htmlInput: { min: 0, step: "0.01" },
                      }}
                    />
                    <TextField
                      label="Daily cap"
                      name="daily_cap_ghs"
                      type="number"
                      size="small"
                      placeholder="Optional"
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              GHS
                            </InputAdornment>
                          ),
                        },
                        htmlInput: { min: 0, step: "0.01" },
                      }}
                    />
                    <StyledDateTimeField
                      label="Starts"
                      name="starts_at"
                      size="small"
                      required
                    />
                    <StyledDateTimeField
                      label="Ends"
                      name="ends_at"
                      size="small"
                      required
                    />
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    }}
                  >
                    <TextField
                      label="Description"
                      name="description"
                      multiline
                      minRows={2}
                      size="small"
                    />
                    <TextField
                      label="Review note"
                      name="review_note"
                      multiline
                      minRows={2}
                      size="small"
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
                      onClick={() => setAdDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<CampaignRounded />}
                      disabled={eligibleBusinesses.length === 0}
                    >
                      Create placement
                    </Button>
                  </Stack>
                </Stack>
              </Form>
            </Box>
          </Collapse>
        </Panel>
      ) : null}

      {!adCampaignsError && campaigns.length === 0 ? (
        <Alert severity="info">
          No sponsored placement campaigns are configured yet.
        </Alert>
      ) : null}

      {!adCampaignsError && campaigns.length > 0 ? (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
              alignItems: "start",
            }}
          >
            {pagedCampaigns.map((campaign) => (
              <AdCampaignDetail
                key={campaign.campaignId}
                campaign={campaign}
                onOpen={() => onSelect(campaign.campaignId)}
              />
            ))}
          </Box>
          <PaginationFooter
            count={pageCount}
            label="placements"
            page={page}
            pageSize={4}
            total={campaigns.length}
            onChange={onPageChange}
          />
        </>
      ) : null}
    </>
  );
}
