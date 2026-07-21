import { Form } from "react-router";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { CartItem } from "../../lib/cart";

type CartQuantityProps = {
  item: Pick<CartItem, "line_id" | "quantity" | "title">;
  maxQuantity: number;
};

function QuantityButton({
  item,
  maxQuantity,
  delta,
}: CartQuantityProps & { delta: -1 | 1 }) {
  const increasing = delta > 0;
  const verb = increasing ? "Increase" : "Decrease";
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="quantity" />
      <input type="hidden" name="line_id" value={item.line_id} />
      <input type="hidden" name="quantity" value={item.quantity + delta} />
      <IconButton
        type="submit"
        aria-label={`${verb} ${item.title} quantity`}
        size="small"
        disabled={increasing && item.quantity >= maxQuantity}
      >
        {increasing ? (
          <AddRounded fontSize="small" />
        ) : (
          <RemoveRounded fontSize="small" />
        )}
      </IconButton>
    </Form>
  );
}

export default function CartQuantity({ item, maxQuantity }: CartQuantityProps) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <QuantityButton item={item} maxQuantity={maxQuantity} delta={-1} />
      <Typography
        aria-label={`${item.title} quantity`}
        sx={{ minWidth: 28, textAlign: "center", fontWeight: 800 }}
      >
        {item.quantity}
      </Typography>
      <QuantityButton item={item} maxQuantity={maxQuantity} delta={1} />
    </Stack>
  );
}
