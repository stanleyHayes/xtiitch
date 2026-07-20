import {
  Form,
  Link as RouterLink,
  data,
  redirect,
} from "react-router";
import Alert from "@mui/material/Alert";
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
import { api } from "../lib/api";
import { requestTenant } from "../lib/tenant";
import {
  cartTotalMinor,
  clearCart,
  getCart,
  itemsForStore,
  keepOnlyStore,
  removeFromCart,
  storeHandlesInCart,
} from "../lib/cart";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Your cart · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

// storeNames resolves each basket's DISPLAY name for its header (§5.1: designs
// group under "that store's basket name"). One fetch per store, parallel;
// a failed lookup falls back to the handle so the cart always renders.
async function storeNames(
  handles: string[],
  tenant: string | null,
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    handles.map(async (handle) => {
      const page = await api.store(handle, tenant).catch(() => null);
      return [handle, page?.store.name ?? handle] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function loader({ request }: Route.LoaderArgs) {
  const tenant = requestTenant(request);
  const { items } = await getCart(request);
  // §6: a tenant store's cart holds only that store's designs. Foreign lines
  // (e.g. from a cookie written before isolation) are dropped from the cookie
  // outright — they can't legitimately exist anymore.
  const dropCookie = tenant ? await keepOnlyStore(request, tenant) : null;
  const scopedItems = tenant ? itemsForStore(items, tenant) : items;

  // Group the basket by store; each store checks out on its own (§5.2).
  const handles = storeHandlesInCart(scopedItems);
  const names = await storeNames(handles, tenant);
  const groups = handles.map((handle) => {
    const storeItems = itemsForStore(scopedItems, handle);
    return {
      handle,
      name: names[handle] ?? handle,
      items: storeItems,
      subtotalMinor: cartTotalMinor(storeItems),
    };
  });

  // §5.2: after Paystack returns the customer to /cart?paid=<handle>, the paid
  // basket is already cleared; when no other baskets remain, the customer goes
  // straight back to the storefront home.
  const url = new URL(request.url);
  const paidHandle = (url.searchParams.get("paid") ?? "").trim();
  if (paidHandle && groups.length === 0) {
    return redirect("/");
  }
  let paidName = "";
  if (paidHandle) {
    const paidNames = await storeNames([paidHandle], tenant);
    paidName = paidNames[paidHandle] ?? paidHandle;
  }

  return data(
    {
      tenantHost: Boolean(tenant),
      groups,
      totalMinor: cartTotalMinor(scopedItems),
      paidName,
    },
    dropCookie ? { headers: { "Set-Cookie": dropCookie } } : undefined,
  );
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

export default function Cart({ loaderData }: Route.ComponentProps) { // eslint-disable-line max-lines-per-function -- route action/loader with many conditional branches; refactor in follow-up
  const { tenantHost, groups, totalMinor, paidName } = loaderData;
  const multiStore = groups.length > 1;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container sx={{ py: { xs: 4, md: 6 }, maxWidth: "md" }}>
        <Button
          component={RouterLink}
          to="/"
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

        {paidName ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Payment to {paidName} successful — that basket is settled. Pay each
            remaining studio's basket one at a time below.
          </Alert>
        ) : null}

        {groups.length === 0 ? (
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
              Your cart is empty. Browse the designs and add pieces to your
              cart.
            </Typography>
            {/* §6: on a tenant host this is the store's OWN storefront ("/"),
                never the marketplace AI Search page; on the marketplace "/"
                is the cross-store browse, which is fine there. */}
            <Button
              component={RouterLink}
              to="/"
              variant="contained"
              sx={{ mt: 2 }}
            >
              Discover designs
            </Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            {multiStore ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Your basket has pieces from {groups.length} studios. Each studio
                is paid separately, so you'll check out one at a time.
              </Typography>
            ) : null}

            {groups.map((group) => (
              <Stack
                key={group.handle}
                spacing={1.5}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: { xs: 1.5, md: 2 },
                }}
              >
                {/* §5.1: the basket header carries the store's display name and
                    its own design count, total and checkout button. */}
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 1,
                  }}
                >
                  <Typography
                    sx={{ fontWeight: 900, minWidth: 0 }}
                    noWrap
                    component={tenantHost ? "span" : RouterLink}
                    {...(tenantHost
                      ? {}
                      : {
                          to: `/store/${encodeURIComponent(group.handle)}`,
                          style: { color: "inherit", textDecoration: "none" },
                        })}
                  >
                    {group.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", flexShrink: 0 }}
                  >
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "design" : "designs"}
                  </Typography>
                </Stack>

                {group.items.map((item) => (
                  <Stack
                    key={item.line_id}
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center" }}
                  >
                    <Box
                      component="img"
                      src={
                        item.image || "/images/storefront-atelier-review.webp"
                      }
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
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
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
                      <input
                        type="hidden"
                        name="line_id"
                        value={item.line_id}
                      />
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
                  sx={{
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography sx={{ fontWeight: 900 }}>
                    {multiStore ? "Basket subtotal" : "Total"}
                  </Typography>
                  <Typography
                    sx={{ fontWeight: 900, color: "primary.main" }}
                  >
                    {formatGHS(group.subtotalMinor)}
                  </Typography>
                </Stack>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    component={RouterLink}
                    to={`/checkout?store=${encodeURIComponent(group.handle)}`}
                    variant="contained"
                    size="large"
                  >
                    Proceed to checkout
                  </Button>
                </Box>
              </Stack>
            ))}

            {/* §5.2: the cross-store total may be shown for information ONLY —
                there is no button that pays all stores in one charge. */}
            {multiStore ? (
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: { xs: 1.5, md: 2 },
                }}
              >
                <Typography sx={{ fontWeight: 900 }}>
                  Total across studios
                </Typography>
                <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
                  {formatGHS(totalMinor)}
                </Typography>
              </Stack>
            ) : null}

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Form method="post">
                <input type="hidden" name="intent" value="clear" />
                <Button type="submit" color="inherit">
                  Clear cart
                </Button>
              </Form>
            </Box>
          </Stack>
        )}
      </Container>
    </Box>
  );
}
