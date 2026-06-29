import { Form, Link as RouterLink, redirect } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import type { Route } from "./+types/cart";
import { tokens } from "../theme";
import { formatGHS } from "../lib/format";
import {
  cartTotalMinor,
  clearCart,
  getCart,
  removeFromCart,
} from "../lib/cart";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Your cart · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { storeHandle, items } = await getCart(request);
  return { storeHandle, items, totalMinor: cartTotalMinor(items) };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "remove") {
    const lineID = String(form.get("line_id") ?? "");
    return redirect("/cart", {
      headers: { "Set-Cookie": await removeFromCart(request, lineID) },
    });
  }
  if (intent === "clear") {
    return redirect("/cart", {
      headers: { "Set-Cookie": await clearCart(request) },
    });
  }
  return null;
}

export default function Cart({ loaderData }: Route.ComponentProps) {
  const { storeHandle, items, totalMinor } = loaderData;
  const storeHref = storeHandle ? `/store/${storeHandle}` : "/discover";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container sx={{ py: { xs: 4, md: 6 }, maxWidth: "md" }}>
        <Button
          component={RouterLink}
          to={storeHref}
          variant="text"
          startIcon={<ArrowBackRounded />}
          sx={{ px: 0, color: "text.secondary", fontWeight: 800, mb: 2 }}
        >
          Continue shopping
        </Button>

        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", mb: 2 }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(tokens.burgundy, 0.1),
              color: tokens.burgundy,
            }}
          >
            <ShoppingBagRounded />
          </Box>
          <Typography variant="h4" component="h1">
            Your cart
          </Typography>
        </Stack>

        {items.length === 0 ? (
          <Box
            sx={{
              p: 4,
              textAlign: "center",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
            }}
          >
            <Typography sx={{ color: "text.secondary" }}>
              Your cart is empty. Browse a studio and add pieces to your cart.
            </Typography>
            <Button
              component={RouterLink}
              to="/discover"
              variant="contained"
              sx={{ mt: 2 }}
            >
              Discover studios
            </Button>
          </Box>
        ) : (
          <Stack
            spacing={1.5}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: { xs: 1.5, md: 2 },
            }}
          >
            {items.map((item) => (
              <Stack
                key={item.line_id}
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <Box
                  component="img"
                  src={item.image || "/images/storefront-atelier-review.webp"}
                  alt={item.title}
                  sx={{
                    width: 56,
                    height: 70,
                    objectFit: "cover",
                    borderRadius: 1.5,
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }} noWrap>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {item.kind === "bespoke"
                      ? "Bespoke deposit"
                      : item.size_label}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 800 }}>
                  {formatGHS(item.amount_minor)}
                </Typography>
                <Form method="post">
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="line_id" value={item.line_id} />
                  <IconButton
                    type="submit"
                    aria-label={`Remove ${item.title}`}
                    size="small"
                    color="error"
                  >
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </Form>
              </Stack>
            ))}

            <Divider />
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <Typography sx={{ fontWeight: 900 }}>Total</Typography>
              <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
                {formatGHS(totalMinor)}
              </Typography>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ justifyContent: "flex-end" }}
            >
              <Form method="post">
                <input type="hidden" name="intent" value="clear" />
                <Button type="submit" color="inherit">
                  Clear cart
                </Button>
              </Form>
              <Button
                component={RouterLink}
                to="/checkout"
                variant="contained"
                size="large"
              >
                Proceed to checkout
              </Button>
            </Stack>
          </Stack>
        )}
      </Container>
    </Box>
  );
}
