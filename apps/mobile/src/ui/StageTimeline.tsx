import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { type TrackingStage } from "../api";
import { fonts, radius, spacing, type Palette } from "../theme";
import { useTheme } from "../theme-mode";

// Vertical fulfilment timeline shared by the customer track screen and the
// studio order detail. Sorts by sequence and colours each node by completion.
export function StageTimeline({ stages }: { stages: TrackingStage[] }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const ordered = [...stages].sort((a, b) => a.sequence - b.sequence);
  return (
    <View style={styles.timeline}>
      {ordered.map((stage, index) => {
        const isLast = index === ordered.length - 1;
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
                    stage.is_complete && {
                      backgroundColor: stage.colour || palette.success,
                    },
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
                {stage.is_complete
                  ? "Done"
                  : stage.is_current
                    ? "In progress"
                    : "Upcoming"}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    timeline: {
      backgroundColor: palette.white,
      borderRadius: radius.lg,
      padding: spacing(2.5),
      borderWidth: 1,
      borderColor: palette.softBorder,
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
    connector: {
      width: 3,
      flex: 1,
      minHeight: 30,
      backgroundColor: palette.softBorder,
      marginVertical: 2,
    },
    stageBody: { flex: 1, paddingBottom: spacing(2.5) },
    stageName: { fontFamily: fonts.display, fontSize: 17, color: palette.ink },
    stagePending: { color: palette.mutedText },
    stageState: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: 2,
    },
  });
