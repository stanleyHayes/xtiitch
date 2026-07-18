import { useCallback, useEffect, useState, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import {
  api,
  type AvailabilitySlot,
  type Design,
  type PlaceOrderResult,
} from "../../../src/api";
import { CenterState } from "../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { availabilityRangeForRequest } from "./visit-slots";
import DesignBespokePanel from "./DesignBespokePanel";
import DesignGallery from "./DesignGallery";
import DesignOrderConfirmation from "./DesignOrderConfirmation";
import DesignOrderForm from "./DesignOrderForm";
import DesignWaitlistPanel from "./DesignWaitlistPanel";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; design: Design };

export default function DesignScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [order, setOrder] = useState<PlaceOrderResult | null>(null);
  const [customising, setCustomising] = useState(false);
  const [visitSlots, setVisitSlots] = useState<AvailabilitySlot[]>([]);

  const load = useCallback(async () => {
    if (!handle) return;
    setState({ phase: "loading" });
    const result = await api.design(handle);
    if (!result.ok) {
      setState({
        phase: "error",
        message:
          result.status === 404
            ? "This piece is no longer available."
            : "Couldn't load this piece. Please retry.",
      });
      return;
    }
    const design = result.data;
    setState({ phase: "ready", design });
    // Mirrors the web design loader: visit slots are only fetched when the
    // bespoke flow can actually be offered.
    const store = design.store;
    if (
      store?.handle &&
      design.customisation_allowed &&
      store.settings.bespoke_enabled
    ) {
      // A bespoke-only design (no listed sizes) opens straight into the
      // customise view — its only way forward.
      setCustomising(design.prices.length === 0);
      const availability = await api.availability(
        store.handle,
        availabilityRangeForRequest(),
      );
      if (availability.ok) {
        setVisitSlots(availability.data.slots);
      }
    } else {
      setCustomising(false);
    }
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.phase === "loading") return <CenterState loading />;
  if (state.phase === "error")
    return (
      <CenterState title="Unavailable" hint={state.message} onRetry={load} />
    );

  const { design } = state;
  const store = design.store;
  const canCustomise = Boolean(
    store?.handle &&
      design.customisation_allowed &&
      store.settings.bespoke_enabled,
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: design.title }} />

      <DesignGallery design={design} />

      <Text style={styles.title}>{design.title}</Text>
      {store ? (
        <Pressable onPress={() => router.push(`/store/${store.handle}`)}>
          <Text style={styles.storeLink}>{store.name} ›</Text>
        </Pressable>
      ) : null}
      {design.description ? (
        <Text style={styles.description}>{design.description}</Text>
      ) : null}

      {order ? (
        <DesignOrderConfirmation
          order={order}
          onTrack={() => router.push(`/track/${order.order_id}`)}
        />
      ) : store ? (
        <View>
          {customising ? (
            <View>
              {design.prices.length > 0 ? (
                <Pressable
                  onPress={() => setCustomising(false)}
                  style={styles.backToSizes}
                >
                  <Text style={styles.backToSizesText}>
                    ‹ Back to listed sizes
                  </Text>
                </Pressable>
              ) : null}
              <DesignBespokePanel
                design={design}
                store={store}
                visitSlots={visitSlots}
                onOrdered={setOrder}
              />
            </View>
          ) : (
            <View>
              <DesignOrderForm
                design={design}
                store={store}
                onOrdered={setOrder}
              />
              {canCustomise ? (
                <Pressable
                  onPress={() => setCustomising(true)}
                  style={styles.customiseCta}
                >
                  <Text style={styles.customiseCtaText}>
                    Customise this piece
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <DesignWaitlistPanel store={store} design={design} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    title: {
      fontFamily: fonts.display,
      fontSize: 28,
      color: palette.ink,
      fontWeight: "700",
      marginTop: spacing(2),
    },
    storeLink: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.burgundy,
      marginTop: spacing(0.5),
    },
    description: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
      lineHeight: 23,
      marginTop: spacing(1.5),
    },
    backToSizes: { marginTop: spacing(2.5) },
    backToSizesText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      color: palette.mutedText,
    },
    customiseCta: {
      borderWidth: 1.5,
      borderColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.75),
      alignItems: "center",
      marginTop: spacing(2),
    },
    customiseCtaText: {
      color: palette.burgundy,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
    },
  });
