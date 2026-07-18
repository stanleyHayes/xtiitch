import { useCallback, useEffect, useState, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { api, type Tracking } from "../../src/api";
import { CenterState, StageTimeline } from "../../src/ui";
import { fonts, radius, shadow, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import TrackHandoverPanel from "../features/track/TrackHandoverPanel";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; tracking: Tracking };

// Mirrors the web track page's progress formula (features/track/track-page.tsx):
// fulfilled pins the bar at 100%, otherwise completed stages plus half credit
// for the current one.
function progressPercent(tracking: Tracking): number {
  if (tracking.status === "fulfilled") return 100;
  if (tracking.stages.length === 0) return 0;
  const completed = tracking.stages.filter((stage) => stage.is_complete).length;
  const hasCurrent = tracking.stages.some((stage) => stage.is_current);
  return Math.min(
    100,
    Math.round(((completed + (hasCurrent ? 0.5 : 0)) / tracking.stages.length) * 100),
  );
}

export default function TrackScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
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
    return (
      <CenterState
        title="Order not found"
        hint={state.message}
        onRetry={load}
      />
    );

  const { tracking } = state;
  const fulfilled = tracking.status === "fulfilled";
  const progress = progressPercent(tracking);
  const pillColor = fulfilled
    ? palette.success
    : tracking.colour || palette.burgundy;
  const pillLabel = fulfilled ? "Ready" : tracking.stage_name;
  const shortCode = tracking.order_id.slice(0, 5).toUpperCase();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Track order" }} />

      <View style={styles.headerCard}>
        <Text style={styles.store}>{tracking.store_name}</Text>
        <Text style={styles.design}>{tracking.design_title}</Text>
        <View style={[styles.statusPill, { backgroundColor: pillColor }]}>
          <Text style={styles.statusPillText}>{pillLabel}</Text>
        </View>
        <Text style={styles.orderId}>Order #{shortCode}</Text>
      </View>

      {tracking.handover ? (
        <TrackHandoverPanel handover={tracking.handover} />
      ) : null}

      <Text style={styles.sectionLabel}>Progress</Text>
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>{progress}% complete</Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progress}%`,
              backgroundColor: fulfilled ? palette.success : palette.burgundy,
            },
          ]}
        />
      </View>
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

const makeStyles = (palette: Palette) => StyleSheet.create({
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
  statusPillText: { color: palette.onAccent, fontFamily: fonts.body, fontWeight: "800", fontSize: 13 },
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
  progressHeader: { marginBottom: spacing(1) },
  progressText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    color: palette.ink,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.softBorder,
    overflow: "hidden",
    marginBottom: spacing(2),
  },
  progressBar: {
    height: "100%",
    borderRadius: radius.pill,
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
