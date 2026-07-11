import { useSubmit } from "react-router";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import TextField from "../../../components/form-text-field";
import { formatGHS } from "../../../lib/format";
import { tokens } from "../../../theme";
import { Panel } from "../../../components/ui/Panel";
import { PaginationFooter } from "../../../components/ui/PaginationFooter";
import type { MeasurementField, OrderSummary } from "../../shared/types";
import { usePagedItems } from "../../shared/hooks";
import {
  orderBalanceDueMinor,
  stageColor,
  statusLabel,
  measurementSourceFor,
} from "../utils";
import { orderInitials } from "../../shared/utils";
import { OrderActionMenuItem } from "../OrderActionMenuItem";
import { OrderCard } from "../OrderCard";
import { OrderRow } from "./OrderRow";

export function OrdersTable({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  orders,
  returnTo,
  measurementFields,
  showMoneyDetails,
}: {
  orders: OrderSummary[];
  returnTo: string;
  measurementFields: MeasurementField[];
  showMoneyDetails: boolean;
}) {
  const submit = useSubmit();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuOrderId, setMenuOrderId] = useState<string | null>(null);
  // Filter by source: online (storefront checkout) vs in-person (walk-in).
  const [channelFilter, setChannelFilter] = useState<
    "all" | "online" | "walk_in"
  >("all");
  // Free-text search so a high-volume store can find a specific order by the
  // design, the customer (name/phone/email), or the short reference.
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const visibleOrders = orders.filter((order) => {
    if (channelFilter !== "all" && order.channel !== channelFilter) {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    return [
      order.design_title,
      order.customer_name,
      order.customer_phone,
      order.customer_email,
      order.order_id,
    ].some((field) => (field ?? "").toLowerCase().includes(normalizedSearch));
  });
  const onlineCount = orders.filter(
    (order) => order.channel === "online",
  ).length;
  const {
    page: orderPage,
    pageCount: orderPageCount,
    pagedItems: pagedOrders,
    setPage: setOrderPage,
  } = usePagedItems(
    visibleOrders,
    10,
    `${channelFilter}:${normalizedSearch}:${visibleOrders.length}`,
  );

  const detailOrder =
    orders.find((order) => order.order_id === detailId) ?? null;
  const menuOrder =
    orders.find((order) => order.order_id === menuOrderId) ?? null;
  const menuOrderColour = menuOrder
    ? stageColor(menuOrder.colour)
    : tokens.burgundy;
  const menuOrderBalance = menuOrder ? orderBalanceDueMinor(menuOrder) : 0;

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuOrderId(null);
  };
  const openDetail = (orderId: string) => {
    setDetailId(orderId);
    closeMenu();
  };
  const openMenu = (
    event: React.MouseEvent<HTMLElement>,
    orderId: string,
  ) => {
    setMenuAnchor(event.currentTarget);
    setMenuOrderId(orderId);
  };

  return (
    <>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ mb: 1.5, gap: 1, alignItems: { md: "center" } }}
      >
        <TextField
          label="Search orders"
          placeholder="Name, phone, email, or ref"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {(
            [
              { value: "all", label: `All (${orders.length})` },
              { value: "online", label: `Online (${onlineCount})` },
              {
                value: "walk_in",
                label: `In-person (${orders.length - onlineCount})`,
              },
            ] as const
          ).map((option) => (
            <Button
              key={option.value}
              size="small"
              variant={
                channelFilter === option.value ? "contained" : "outlined"
              }
              onClick={() => setChannelFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </Stack>
      </Stack>
      <TableContainer component={Panel} sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Stage</TableCell>
              {showMoneyDetails ? (
                <TableCell align="right">Total</TableCell>
              ) : null}
              {showMoneyDetails ? (
                <TableCell align="right">Balance</TableCell>
              ) : null}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedOrders.map((order) => (
              <OrderRow
                key={order.order_id}
                order={order}
                showMoneyDetails={showMoneyDetails}
                onOpenMenu={openMenu}
                onOpenDetail={openDetail}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <PaginationFooter
        count={orderPageCount}
        label="orders"
        page={orderPage}
        pageSize={10}
        total={orders.length}
        onChange={setOrderPage}
      />

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          list: { sx: { p: 0 } },
          paper: {
            sx: {
              mt: 1,
              minWidth: { xs: "calc(100vw - 32px)", sm: 336 },
              maxWidth: "calc(100vw - 32px)",
              borderRadius: 3,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              backgroundImage: "none",
              boxShadow: (theme) =>
                `0 28px 72px ${alpha(
                  theme.palette.common.black,
                  theme.palette.mode === "dark" ? 0.62 : 0.22,
                )}`,
            },
          },
        }}
      >
        {menuOrder ? (
          <Box
            sx={{
              px: 2,
              py: 1.75,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              background: (theme) =>
                `linear-gradient(135deg, ${alpha(
                  menuOrderColour,
                  theme.palette.mode === "dark" ? 0.32 : 0.13,
                )}, ${alpha(menuOrderColour, 0)} 78%)`,
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: menuOrderColour,
                color: tokens.white,
                fontWeight: 900,
                boxShadow: `0 10px 24px ${alpha(menuOrderColour, 0.38)}`,
                flexShrink: 0,
              }}
            >
              {orderInitials(menuOrder)}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }} noWrap>
                {menuOrder.design_title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary" }}
                noWrap
              >
                Ref {menuOrder.order_id.slice(0, 8)} ·{" "}
                {menuOrder.customer_name || "Unnamed customer"}
              </Typography>
              <Chip
                size="small"
                label={
                  menuOrderBalance > 0
                    ? `${formatGHS(menuOrderBalance)} due`
                    : statusLabel(menuOrder.status)
                }
                sx={{
                  mt: 0.5,
                  height: 20,
                  fontWeight: 800,
                  fontSize: 11,
                  color: menuOrderBalance > 0 ? "warning.main" : "primary.main",
                  bgcolor: (theme) =>
                    alpha(
                      menuOrderBalance > 0
                        ? theme.palette.warning.main
                        : theme.palette.primary.main,
                      0.12,
                    ),
                  "& .MuiChip-label": { px: 1 },
                }}
              />
            </Box>
          </Box>
        ) : null}
        <Box sx={{ py: 0.5 }}>
          <OrderActionMenuItem
            icon={<VisibilityRounded fontSize="small" />}
            label="View detail"
            helper="Open the full order drawer"
            onClick={() => menuOrderId && openDetail(menuOrderId)}
          />
          {menuOrder && menuOrder.status === "confirmed" ? (
            <OrderActionMenuItem
              icon={<TimelineRounded fontSize="small" />}
              label="Advance stage"
              helper="Move this order to the next step"
              onClick={() => {
                submit(
                  {
                    intent: "advance",
                    order_id: menuOrder.order_id,
                    return_to: returnTo,
                  },
                  { method: "post" },
                );
                closeMenu();
              }}
            />
          ) : null}
          {showMoneyDetails ? (
            <OrderActionMenuItem
              icon={<PaymentsRounded fontSize="small" />}
              label="Manage payment"
              helper="Review balances and payment notes"
              onClick={() => menuOrderId && openDetail(menuOrderId)}
            />
          ) : null}
          {menuOrder && measurementSourceFor(menuOrder) ? (
            <OrderActionMenuItem
              icon={<StraightenRounded fontSize="small" />}
              label="Record measurements"
              helper="Capture fitting values for this order"
              onClick={() => menuOrderId && openDetail(menuOrderId)}
            />
          ) : null}
        </Box>
      </Menu>

      <Drawer
        anchor="right"
        open={Boolean(detailOrder)}
        onClose={() => setDetailId(null)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: "100%", sm: 480 },
              maxWidth: "100%",
              p: { xs: 2, md: 2.5 },
              bgcolor: "background.default",
            },
          },
        }}
      >
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1.5,
          }}
        >
          <Typography sx={{ fontWeight: 900 }}>Order detail</Typography>
          <IconButton
            size="small"
            aria-label="Close order detail"
            onClick={() => setDetailId(null)}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>
        {detailOrder ? (
          <OrderCard
            order={detailOrder}
            returnTo={returnTo}
            measurementFields={measurementFields}
            showMoneyDetails={showMoneyDetails}
          />
        ) : null}
      </Drawer>
    </>
  );
}
