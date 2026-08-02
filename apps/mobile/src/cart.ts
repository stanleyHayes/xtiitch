import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartOrderLine } from "./orderContracts";

const KEY = "xtiitch.customer.cart.v1";
const PENDING_KEY = "xtiitch.customer.cart-payments.v1";
export const MAX_ITEMS_PER_STORE = 10;

export type CartItem = CartOrderLine & {
  line_id: string;
  store_handle: string;
  store_name: string;
  design_title: string;
  image_url: string;
  size_label: string;
  price_minor: number;
  quantity: number;
};

export type PendingCartPayment = {
  store_handle: string;
  store_name: string;
  order_id: string;
  reference: string;
  created_at: string;
};

export async function loadPendingCartPayments(): Promise<PendingCartPayment[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const value = raw ? (JSON.parse(raw) as PendingCartPayment[]) : [];
    return Array.isArray(value) ? value.filter((item) => item.reference) : [];
  } catch {
    return [];
  }
}

export async function setPendingCartPayment(
  payment: PendingCartPayment,
): Promise<void> {
  const current = await loadPendingCartPayments();
  await AsyncStorage.setItem(
    PENDING_KEY,
    JSON.stringify([
      ...current.filter((item) => item.store_handle !== payment.store_handle),
      payment,
    ]),
  );
}

export async function clearPendingCartPayment(storeHandle: string) {
  const current = await loadPendingCartPayments();
  await AsyncStorage.setItem(
    PENDING_KEY,
    JSON.stringify(current.filter((item) => item.store_handle !== storeHandle)),
  );
}

export async function loadCart(): Promise<CartItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(value) ? value.filter(validItem) : [];
  } catch {
    return [];
  }
}

function validItem(item: CartItem): boolean {
  return (
    Boolean(item?.line_id && item.store_handle && item.design_handle) &&
    item.quantity > 0
  );
}

async function save(items: CartItem[]): Promise<CartItem[]> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  return items;
}

export async function addCartItem(
  input: Omit<CartItem, "line_id" | "quantity">,
): Promise<
  { ok: true; items: CartItem[] } | { ok: false; error: "store_limit" }
> {
  const items = await loadCart();
  const sameStoreCount = items
    .filter((item) => item.store_handle === input.store_handle)
    .reduce((sum, item) => sum + item.quantity, 0);
  if (sameStoreCount >= MAX_ITEMS_PER_STORE)
    return { ok: false, error: "store_limit" };
  const match = items.find(
    (item) =>
      item.store_handle === input.store_handle &&
      item.design_handle === input.design_handle &&
      item.size_band_id === input.size_band_id &&
      item.kind === input.kind,
  );
  if (match) match.quantity += 1;
  else
    items.push({
      ...input,
      quantity: 1,
      line_id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    });
  return { ok: true, items: await save(items) };
}

export async function updateCartQuantity(
  lineId: string,
  quantity: number,
): Promise<CartItem[]> {
  const items = await loadCart();
  if (quantity <= 0)
    return save(items.filter((item) => item.line_id !== lineId));
  return save(
    items.map((item) =>
      item.line_id === lineId
        ? { ...item, quantity: Math.min(quantity, MAX_ITEMS_PER_STORE) }
        : item,
    ),
  );
}

export async function clearStoreCart(storeHandle: string): Promise<CartItem[]> {
  return save(
    (await loadCart()).filter((item) => item.store_handle !== storeHandle),
  );
}

export function groupCart(
  items: CartItem[],
): { handle: string; name: string; items: CartItem[]; total_minor: number }[] {
  const groups = new Map<string, CartItem[]>();
  items.forEach((item) =>
    groups.set(item.store_handle, [
      ...(groups.get(item.store_handle) ?? []),
      item,
    ]),
  );
  return [...groups].map(([handle, storeItems]) => ({
    handle,
    name: storeItems[0]?.store_name ?? handle,
    items: storeItems,
    total_minor: storeItems.reduce(
      (sum, item) => sum + item.price_minor * item.quantity,
      0,
    ),
  }));
}

export function expandCartLines(items: CartItem[]): CartOrderLine[] {
  return items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      design_handle: item.design_handle,
      size_band_id: item.size_band_id,
      kind: item.kind,
      size_mode: item.size_mode,
      measurements: item.measurements,
      note: item.note,
    })),
  );
}
