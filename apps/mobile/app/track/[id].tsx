import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { api, type Tracking } from "../../src/api";
import { CenterState } from "../../src/ui";
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
  const stages = [...tracking.stages].sort((a, b) => a.sequence - b.sequence);

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
      <View style={styles.timeline}>
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;
          const dotColor = stage.is_complete
            ? stage.colour || palette.success
            : stage.is_current
              ? stage.colour || palette.burgundy
              : palette.softBorder;
          return (
            <View key={`${stage.name}-${stage.sequence}`} style={styles.stageRow}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: dotColor },
                    stage.is_current && styles.dotCurrent,
                  ]}
                />
                {!isLast ? (
                  <View
                    style={[
                      styles.connector,
                      stage.is_complete && { backgroundColor: stage.colour || palette.success },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.stageBody}>
                <Text
                  style={[
                    styles.stageName,
                    stage.is_current && { color: palette.burgundy, fontWeight: "800" },
                    !stage.is_complete && !stage.is_current && styles.stagePending,
                  ]}
                >
                  {stage.name}
                </Text>
                <Text style={styles.stageState}>
                  {stage.is_complete ? "Done" : stage.is_current ? "In progress" : "Upcoming"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

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
  timeline: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: spacing(2.5),
    ...shadow.card,
  },
  stageRow: { flexDirection: "row", gap: spacing(2) },
  rail: { alignItems: "center", width: 18 },
  dot: { width: 16, height: 16, borderRadius: 8, marginTop: 2 },
  dotCurrent: {
    borderWidth: 4,
    borderColor: "rgba(128,0,32,0.18)",
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  connector: { width: 3, flex: 1, minHeight: 30, backgroundColor: palette.softBorder, marginVertical: 2 },
  stageBody: { flex: 1, paddingBottom: spacing(2.5) },
  stageName: { fontFamily: fonts.display, fontSize: 17, color: palette.ink },
  stagePending: { color: palette.mutedText },
  stageState: { fontFamily: fonts.body, fontSize: 13, color: palette.mutedText, marginTop: 2 },
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
