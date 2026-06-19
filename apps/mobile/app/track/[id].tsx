import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { api, type Tracking } from "../../src/api";
import { CenterState, StageTimeline } from "../../src/ui";
import { fonts, palette, radius, shadow, spacing } from "../../src/theme";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; tracking: Tracking };

export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const load = useCallback(async () => {
    if (!id) return;
    setState({ phase: "loading" });
    const result = await api.tracking(id);
    if (result.ok) {
      setState({ phase: "ready", tracking: result.data });
    } else {
      setState({
        phase: "error",
        message:
          result.status === 404
            ? `No order found for "${id}". Check the id on your receipt.`
            : "Couldn't load tracking. Please retry.",
      });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.phase === "loading") return <CenterState loading />;
  if (state.phase === "error")
    return <CenterState title="Order not found" hint={state.message} />;

  const { tracking } = state;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Track order" }} />

      <View style={styles.headerCard}>
        <Text style={styles.store}>{tracking.store_name}</Text>
        <Text style={styles.design}>{tracking.design_title}</Text>
        <View style={[styles.statusPill, { backgroundColor: tracking.colour || palette.burgundy }]}>
          <Text style={styles.statusPillText}>{tracking.stage_name}</Text>
        </View>
        <Text style={styles.orderId}>Order {tracking.order_id}</Text>
      </View>

      <Text style={styles.sectionLabel}>Progress</Text>
      <StageTimeline stages={tracking.stages} />

      <Pressable
        style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.8 }]}
        onPress={load}
      >
        <Text style={styles.refreshText}>Refresh status</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { padding: spacing(3), paddingBottom: spacing(6) },
  headerCard: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: spacing(3),
    ...shadow.card,
  },
  store: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: palette.gold,
  },
  design: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: palette.ink,
    fontWeight: "700",
    marginTop: spacing(0.5),
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.75),
    marginTop: spacing(1.5),
  },
  statusPillText: { color: palette.white, fontFamily: fonts.body, fontWeight: "800", fontSize: 13 },
  orderId: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.mutedText,
    marginTop: spacing(1.5),
  },
  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: palette.mutedText,
    marginTop: spacing(3),
    marginBottom: spacing(1.5),
  },
  refresh: {
    borderWidth: 1.5,
    borderColor: palette.burgundy,
    borderRadius: radius.pill,
    paddingVertical: spacing(1.75),
    alignItems: "center",
    marginTop: spacing(3),
  },
  refreshText: { color: palette.burgundy, fontFamily: fonts.body, fontSize: 15, fontWeight: "800" },
});
