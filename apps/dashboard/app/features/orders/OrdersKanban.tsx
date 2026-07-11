import { Form } from "react-router";
import { useSubmit } from "react-router";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { OrderSummary, Stage } from "../shared/types";
import { orderFlow, orderBoardKey, orderBoardRank } from "./utils";
import { ToneChip } from "../../components/ui/ToneChip";

export function OrdersKanban({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  orders,
  stages,
  returnTo,
  showMoneyDetails,
}: {
  orders: OrderSummary[];
  stages: Stage[];
  returnTo: string;
  showMoneyDetails: boolean;
}) {
  const submit = useSubmit();
  const [dragging, setDragging] = useState<OrderSummary | null>(null);
  const hasStageColumns = stages.length > 0;
  // A business runs one stage set per flow; only offer the flow switch when both
  // flows are configured. Default to whichever flow the visible orders sit in.
  const flowsWithStages = Array.from(new Set(stages.map((stage) => stage.flow)));
  const orderFlows = new Set(orders.map(orderFlow));
  const defaultFlow =
    flowsWithStages.find((candidate) => orderFlows.has(candidate)) ??
    flowsWithStages[0] ??
    "ready_made";
  const [flow, setFlow] = useState<string>(defaultFlow);
  const activeFlow = flowsWithStages.includes(flow) ? flow : defaultFlow;

  // Seed one column per stage of the active flow (in sequence order) so even
  // empty stages render as columns — the board reads as the full pipeline, not
  // only the stages live orders happen to sit in.
  const flowStages = stages
    .filter((stage) => stage.flow === activeFlow)
    .sort((a, b) => a.sequence - b.sequence);
  const stageRankByName = new Map<string, number>();
  flowStages.forEach((stage) => stageRankByName.set(stage.name, 10 + stage.sequence));
  // The column a given order sits in: confirmed orders use their stage's rank so
  // drag-to-advance compares columns consistently; others keep their lifecycle rank.
  const orderColumnRank = (order: OrderSummary): number =>
    stageRankByName.get(orderBoardKey(order)) ?? orderBoardRank(order);

  const columnsMap = new Map<
    string,
    { key: string; rank: number; colour?: string; orders: OrderSummary[] }
  >();
  const seededKeys = new Set<string>();
  if (hasStageColumns) {
    for (const stage of flowStages) {
      columnsMap.set(stage.name, {
        key: stage.name,
        rank: 10 + stage.sequence,
        colour: stage.colour,
        orders: [],
      });
      seededKeys.add(stage.name);
    }
  }
  // When stages are known, only show the active flow's orders; otherwise fall
  // back to the previous behaviour of grouping every order by its board key.
  const boardOrders = hasStageColumns
    ? orders.filter((order) => orderFlow(order) === activeFlow)
    : orders;
  for (const order of boardOrders) {
    const key = orderBoardKey(order);
    const existing = columnsMap.get(key);
    if (existing) {
      existing.orders.push(order);
      if (!seededKeys.has(key)) {
        existing.rank = Math.min(existing.rank, orderBoardRank(order));
      }
    } else {
      columnsMap.set(key, {
        key,
        rank: orderBoardRank(order),
        orders: [order],
      });
    }
  }
  const columns = Array.from(columnsMap.values()).sort(
    (a, b) => a.rank - b.rank || a.key.localeCompare(b.key),
  );

  const advance = (orderID: string) => {
    const data = new FormData();
    data.set("intent", "advance");
    data.set("order_id", orderID);
    data.set("return_to", returnTo);
    submit(data, { method: "post" });
  };

  return (
    <Stack spacing={1.25}>
      {flowsWithStages.length > 1 ? (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {(
            [
              { value: "ready_made", label: "Made-to-wear" },
              { value: "bespoke", label: "Bespoke" },
            ] as const
          )
            .filter((option) => flowsWithStages.includes(option.value))
            .map((option) => (
              <Button
                key={option.value}
                size="small"
                variant={activeFlow === option.value ? "contained" : "outlined"}
                onClick={() => setFlow(option.value)}
              >
                {option.label}
              </Button>
            ))}
        </Stack>
      ) : null}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "auto",
          pb: 1,
          alignItems: "flex-start",
        }}
      >
        {columns.map((column) => (
        <Box
          key={column.key}
          onDragOver={(event) => {
            if (dragging && dragging.status === "confirmed") {
              event.preventDefault();
            }
          }}
          onDrop={() => {
            // Forward-only: dropping a confirmed order onto a later column
            // advances it one stage (the API decides the actual next stage).
            if (
              dragging &&
              dragging.status === "confirmed" &&
              column.rank > orderColumnRank(dragging)
            ) {
              advance(dragging.order_id);
            }
            setDragging(null);
          }}
          sx={{
            flex: "0 0 auto",
            width: 260,
            bgcolor: alpha(tokens.ink, 0.04),
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            p: 1.25,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mb: 1 }}
          >
            {column.colour ? (
              <Box
                aria-hidden
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  flexShrink: 0,
                  bgcolor: column.colour,
                }}
              />
            ) : null}
            <Typography sx={{ fontWeight: 900, fontSize: 14 }} noWrap>
              {column.key}
            </Typography>
            <ToneChip label={String(column.orders.length)} tone={tokens.ink} />
          </Stack>
          <Stack spacing={1}>
            {column.orders.map((order) => {
              const advanceable = order.status === "confirmed";
              return (
                <Box
                  key={order.order_id}
                  draggable={advanceable}
                  onDragStart={() => setDragging(order)}
                  onDragEnd={() => setDragging(null)}
                  sx={{
                    bgcolor: "rgba(var(--surface-rgb), 0.96)",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1.5,
                    p: 1.25,
                    cursor: advanceable ? "grab" : "default",
                  }}
                >
                  <Typography sx={{ fontWeight: 800 }} noWrap>
                    {order.design_title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary" }}
                    noWrap
                  >
                    {order.customer_name} ·{" "}
                    {order.channel === "walk_in" ? "Walk-in" : "Online"}
                  </Typography>
                  {showMoneyDetails && order.agreed_total_minor !== null ? (
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      {formatGHS(order.settled_minor)} /{" "}
                      {formatGHS(order.agreed_total_minor)}
                    </Typography>
                  ) : null}
                  {advanceable ? (
                    <Form method="post" style={{ marginTop: 6 }}>
                      <input type="hidden" name="intent" value="advance" />
                      <input
                        type="hidden"
                        name="order_id"
                        value={order.order_id}
                      />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <Button
                        type="submit"
                        size="small"
                        variant="outlined"
                        fullWidth
                      >
                        Advance →
                      </Button>
                    </Form>
                  ) : null}
                </Box>
              );
            })}
          </Stack>
        </Box>
        ))}
      </Box>
    </Stack>
  );
}
