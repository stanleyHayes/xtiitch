import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { api, formatGHS, type DeliveryZone } from "../src/api";
import {
  clearPendingCartPayment,
  clearStoreCart,
  expandCartLines,
  groupCart,
  loadCart,
  loadPendingCartPayments,
  setPendingCartPayment,
  updateCartQuantity,
  type CartItem,
} from "../src/cart";
import { fetchCustomerProfile, loadSession } from "../src/customerAuth";
import { useTheme } from "../src/theme-mode";
import { LoadingButtonLabel } from "../src/ui";
import { checkoutSupport } from "../src/checkoutSupport";
import { makeStyles } from "./cart.styles";

type Contact = { name: string; phone: string; whatsapp: string; email: string };
export default function CartScreen() {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [contact, setContact] = useState<Contact>({
    name: "",
    phone: "",
    whatsapp: "",
    email: "",
  });
  const refresh = useCallback(async () => {
    const pending = await loadPendingCartPayments();
    let next = await loadCart();
    for (const payment of pending) {
      const result = await checkoutSupport.verifyPayment(
        payment.store_handle,
        payment.reference,
      );
      if (result.ok && result.data.status === "succeeded") {
        next = await clearStoreCart(payment.store_handle);
        await clearPendingCartPayment(payment.store_handle);
        setPaymentNotice(
          `Payment to ${payment.store_name} confirmed. That basket is settled.`,
        );
      } else if (result.ok && result.data.status === "failed") {
        await clearPendingCartPayment(payment.store_handle);
        setPaymentNotice(
          `Payment to ${payment.store_name} did not complete. Your basket is still here.`,
        );
      } else {
        setPaymentNotice(
          `Payment to ${payment.store_name} is still being confirmed. Your basket is safe.`,
        );
      }
    }
    setItems(next);
    setLoaded(true);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    loadSession().then((session) =>
      session
        ? fetchCustomerProfile()
            .then(
              (p) =>
                p &&
                setContact({
                  name: p.display_name,
                  phone: p.phone,
                  whatsapp: p.whatsapp_phone,
                  email: p.email,
                }),
            )
            .catch(() => undefined)
        : undefined,
    );
  }, []);
  const quantity = async (lineId: string, next: number) =>
    setItems(await updateCartQuantity(lineId, next));
  if (loaded && items.length === 0)
    return (
      <View style={s.empty}>
        <Stack.Screen options={{ title: "Basket" }} />
        {paymentNotice ? (
          <Text style={s.paymentNotice}>{paymentNotice}</Text>
        ) : null}
        <View style={s.emptyIcon}>
          <Ionicons name="bag-outline" size={34} color={palette.burgundy} />
        </View>
        <Text style={s.emptyTitle}>Your basket is empty</Text>
        <Text style={s.emptyHint}>
          Browse studios, choose a size, and save pieces here before paying.
        </Text>
        <Pressable
          onPress={() => router.replace("/marketplace")}
          style={s.browse}
        >
          <Text style={s.browseText}>Browse marketplace</Text>
        </Pressable>
      </View>
    );
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Basket" }} />
      {paymentNotice ? (
        <Text style={s.paymentNotice}>{paymentNotice}</Text>
      ) : null}
      <View style={s.hero}>
        <Ionicons
          name="bag-handle-outline"
          size={145}
          color={palette.onAccent}
          style={s.watermark}
        />
        <Text style={s.eyebrow}>YOUR BASKET</Text>
        <Text style={s.title}>
          {items.reduce((n, item) => n + item.quantity, 0)} pieces, ready when
          you are
        </Text>
        <Text style={s.subtitle}>
          Each studio is paid separately, so you stay in control of every order.
        </Text>
      </View>
      <Text style={s.section}>Your details</Text>
      <ContactForm value={contact} onChange={setContact} />
      {groupCart(items).map((group) => (
        <StoreBasket
          key={group.handle}
          group={group}
          contact={contact}
          onQuantity={quantity}
        />
      ))}
    </ScrollView>
  );
}
function ContactForm({
  value,
  onChange,
}: {
  value: Contact;
  onChange: (next: Contact) => void;
}) {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const field = (key: keyof Contact, placeholder: string) => (
    <TextInput
      value={value[key]}
      onChangeText={(text) => onChange({ ...value, [key]: text })}
      placeholder={placeholder}
      placeholderTextColor={palette.mutedText}
      autoCapitalize={key === "email" ? "none" : "words"}
      keyboardType={
        key === "phone" || key === "whatsapp"
          ? "phone-pad"
          : key === "email"
            ? "email-address"
            : "default"
      }
      style={s.input}
    />
  );
  return (
    <View style={s.form}>
      {field("name", "Full name")}
      {field("phone", "Phone")}
      {field("whatsapp", "WhatsApp (optional)")}
      {field("email", "Email")}
    </View>
  );
}
type Group = ReturnType<typeof groupCart>[number];
// Checkout state stays local to each studio so separate orders cannot leak
// delivery or payment choices into one another.
// eslint-disable-next-line max-lines-per-function, complexity
function StoreBasket({
  group,
  contact,
  onQuantity,
}: {
  group: Group;
  contact: Contact;
  onQuantity: (id: string, next: number) => Promise<void>;
}) {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [method, setMethod] = useState<"momo" | "card">("momo");
  const [delivery, setDelivery] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .deliveryZones(group.handle)
      .then((result) => result.ok && setZones(result.data.zones));
  }, [group.handle]);
  const ready =
    contact.name.trim().length > 1 &&
    contact.phone.trim().length >= 7 &&
    /.+@.+\..+/.test(contact.email) &&
    (!delivery || (zoneId && address.trim().length > 4));
  const checkout = async () => {
    if (!(await loadSession())) {
      router.push({ pathname: "/account", params: { returnTo: "/cart" } });
      return;
    }
    setBusy(true);
    setError("");
    const result = await api.placeCartOrder(group.handle, {
      items: expandCartLines(group.items),
      customer_name: contact.name.trim(),
      customer_phone: contact.phone.trim(),
      customer_whatsapp: contact.whatsapp.trim() || undefined,
      customer_email: contact.email.trim(),
      method,
      delivery_zone_id: delivery ? zoneId : undefined,
      delivery_address: delivery ? address.trim() : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError("Checkout could not start. Review the details and try again.");
      return;
    }
    await setPendingCartPayment({
      store_handle: group.handle,
      store_name: group.name,
      order_id: result.data.order_id,
      reference: result.data.reference,
      created_at: new Date().toISOString(),
    });
    // Keep the basket until payment success can be confirmed. Clearing on
    // initiation loses the shopper's items when Paystack is abandoned.
    await Linking.openURL(result.data.authorization_url);
  };
  return (
    <>
      <Text style={s.section}>{group.name}</Text>
      <View style={s.group}>
        <View style={s.groupHead}>
          <Text style={s.store}>{group.name}</Text>
          <Text style={s.total}>{formatGHS(group.total_minor)}</Text>
        </View>
        {group.items.map((item) => (
          <View key={item.line_id} style={s.item}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={s.image} />
            ) : (
              <View style={s.image} />
            )}
            <View style={s.itemCopy}>
              <Text style={s.itemTitle}>{item.design_title}</Text>
              <Text style={s.itemHint}>
                {item.size_label} · {formatGHS(item.price_minor)}
              </Text>
            </View>
            <View style={s.quantity}>
              <Pressable
                onPress={() => void onQuantity(item.line_id, item.quantity - 1)}
                style={s.quantityButton}
              >
                <Text style={s.quantityText}>−</Text>
              </Pressable>
              <Text style={s.quantityText}>{item.quantity}</Text>
              <Pressable
                onPress={() => void onQuantity(item.line_id, item.quantity + 1)}
                style={s.quantityButton}
              >
                <Text style={s.quantityText}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <View style={s.selector}>
          {(["momo", "card"] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setMethod(item)}
              style={[s.chip, method === item && s.chipActive]}
            >
              <Text style={[s.chipText, method === item && s.chipTextActive]}>
                {item === "momo" ? "Mobile money" : "Card"}
              </Text>
            </Pressable>
          ))}
        </View>
        {zones.length ? (
          <>
            <View style={s.selector}>
              <Pressable
                onPress={() => setDelivery(false)}
                style={[s.chip, !delivery && s.chipActive]}
              >
                <Text style={[s.chipText, !delivery && s.chipTextActive]}>
                  Pickup
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDelivery(true)}
                style={[s.chip, delivery && s.chipActive]}
              >
                <Text style={[s.chipText, delivery && s.chipTextActive]}>
                  Delivery
                </Text>
              </Pressable>
            </View>
            {delivery ? (
              <>
                <ScrollView horizontal contentContainerStyle={s.selector}>
                  {zones.map((zone) => (
                    <Pressable
                      key={zone.zone_id}
                      onPress={() => setZoneId(zone.zone_id)}
                      style={[s.chip, zoneId === zone.zone_id && s.chipActive]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          zoneId === zone.zone_id && s.chipTextActive,
                        ]}
                      >
                        {zone.name} · {formatGHS(zone.fee_minor)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Delivery address"
                  placeholderTextColor={palette.mutedText}
                  style={s.zone}
                />
              </>
            ) : null}
          </>
        ) : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable
          disabled={!ready || busy}
          onPress={() => void checkout()}
          style={[s.checkout, (!ready || busy) && s.checkoutDisabled]}
        >
          {busy ? (
            <LoadingButtonLabel label="Starting payment" />
          ) : (
            <Text style={s.checkoutText}>Pay {group.name}</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}
