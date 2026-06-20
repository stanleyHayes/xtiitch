// Shared presentational helpers: a centred loading / empty / error state, a
// brand image-or-swatch tile, and the studio order row — so every screen
// handles async outcomes and renders orders the same way.
import { useEffect, useRef, useMemo } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { formatGHS, type TrackingStage } from "./api";
import { useBranding } from "./branding";
import { orderTone, type BusinessOrder } from "./businessApi";
import { fonts, radius, spacing, swatchFor, type Palette } from "./theme";
import { useTheme } from "./theme-mode";

// The ii-stitch brand mark (two dots over two columns) approximated with Views,
// since react-native-svg isn't bundled. Reads as the "ii" signature.
export function XtiitchMark({
  color = "#800020",
  size = 30,
}: {
  color?: string;
  size?: number;
}) {
  const dot = size * 0.22;
  const barW = size * 0.2;
  const barH = size * 0.5;
  const gap = size * 0.16;
  return (
    <View style={{ alignItems: "center" }} accessibilityElementsHidden>
      <View style={{ flexDirection: "row", gap }}>
        <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
        <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
      </View>
      <View style={{ flexDirection: "row", gap, marginTop: size * 0.07 }}>
        <View style={{ width: barW, height: barH, borderRadius: barW / 2, backgroundColor: color }} />
        <View style={{ width: barW, height: barH, borderRadius: barW / 2, backgroundColor: color }} />
      </View>
    </View>
  );
}

// Header lockup: render the operator's custom platform logo when one is set
// (via the branding endpoint), else fall back to the built-in ii-stitch mark.
// Used in the navigation header so every screen carries the active brand.
export function HeaderLogo({ color = "#800020" }: { color?: string }) {
  const { logoUrl } = useBranding();
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        resizeMode="contain"
        accessibilityLabel="Platform logo"
        style={{ height: 28, width: 132 }}
      />
    );
  }
  return <XtiitchMark color={color} size={24} />;
}

export function CenterState({
  loading,
  title,
  hint,
}: {
  loading?: boolean;
  title?: string;
  hint?: string;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.center}>
      {loading ? (
        <View style={styles.skeletonState} accessibilityLabel="Loading content">
          <SkeletonBlock width={96} height={96} radiusOverride={radius.lg} />
          <SkeletonBlock width="72%" height={22} />
          <SkeletonBlock width="88%" height={14} />
          <SkeletonBlock width="56%" height={14} />
        </View>
      ) : (
        <>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </>
      )}
    </View>
  );
}

export function SkeletonBlock({
  width = "100%",
  height = 16,
  radiusOverride = radius.sm,
  style,
}: {
  width?: ViewStyle["width"];
  height?: ViewStyle["height"];
  radiusOverride?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View
      style={[
        styles.skeletonBlock,
        { width, height, borderRadius: radiusOverride },
        style,
      ]}
    />
  );
}

export function SkeletonStack({ rows = 3 }: { rows?: number }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const widths: ViewStyle["width"][] = ["82%", "100%", "64%", "90%"];
  return (
    <View style={styles.skeletonStack} accessibilityLabel="Loading section">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock
          key={`skeleton-${index}`}
          width={widths[index % widths.length]}
          height={index === 0 ? 18 : 13}
        />
      ))}
    </View>
  );
}

export function LoadingButtonLabel({
  label,
  color = "#ffffff",
}: {
  label: string;
  color?: string;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(dot, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.delay(220),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [dots]);

  return (
    <View style={styles.loadingButtonLabel}>
      <Text style={[styles.loadingButtonText, { color }]}>{label}</Text>
      <View style={styles.loadingDots} accessibilityElementsHidden>
        {dots.map((dot, index) => (
          <Animated.View
            key={`loading-dot-${index}`}
            style={[
              styles.loadingDot,
              {
                backgroundColor: color,
                opacity: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.45, 1],
                }),
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -4],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function ImageTile({
  uri,
  seed,
  style,
  radiusOverride,
}: {
  uri?: string | null;
  seed: string;
  style?: object;
  radiusOverride?: number;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [from, to] = swatchFor(seed);
  const borderRadius = radiusOverride ?? radius.md;
  if (uri) {
    return <Image source={{ uri }} style={[{ borderRadius }, style]} />;
  }
  return (
    <View style={[{ backgroundColor: from, borderRadius }, styles.swatch, style]}>
      <View style={[styles.swatchBar, { backgroundColor: to }]} />
    </View>
  );
}

export function OrderRow({
  order,
  onPress,
}: {
  order: BusinessOrder;
  onPress?: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tone = orderTone(order.status);
  const body = (
    <>
      <View style={styles.orderTop}>
        <Text style={styles.orderDesign} numberOfLines={1}>
          {order.design_title}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: tone }]}>
          <Text style={styles.statusPillText}>{order.stage_name || order.status}</Text>
        </View>
      </View>
      <Text style={styles.orderCustomer} numberOfLines={1}>
        {order.customer_name} · {order.channel}
      </Text>
      <View style={styles.orderBottom}>
        <Text style={styles.orderTotal}>{formatGHS(order.agreed_total_minor)}</Text>
        <Text style={styles.orderSettled}>
          {formatGHS(order.settled_minor)} settled
        </Text>
      </View>
    </>
  );
  if (!onPress) return <View style={styles.orderRow}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.85 }]}
    >
      {body}
    </Pressable>
  );
}

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

const makeStyles = (palette: Palette) => StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(4),
    gap: spacing(1),
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
    textAlign: "center",
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.mutedText,
    textAlign: "center",
    lineHeight: 20,
  },
  skeletonState: {
    width: "100%",
    alignItems: "center",
    gap: spacing(1.25),
  },
  skeletonStack: {
    width: "100%",
    gap: spacing(1),
  },
  skeletonBlock: {
    backgroundColor: "rgba(128,0,32,0.11)",
    borderWidth: 1,
    borderColor: "rgba(128,0,32,0.05)",
  },
  loadingButtonLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(0.75),
  },
  loadingButtonText: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "800",
  },
  loadingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(0.35),
    paddingTop: 3,
  },
  loadingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  swatch: { justifyContent: "flex-end", overflow: "hidden" },
  swatchBar: { height: "32%", width: "60%", opacity: 0.7 },
  orderRow: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.softBorder,
    padding: spacing(2),
    gap: spacing(0.75),
  },
  orderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(1),
  },
  orderDesign: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 17,
    color: palette.ink,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
  },
  statusPillText: {
    color: palette.onAccent,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  orderCustomer: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.mutedText,
  },
  orderBottom: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing(1.25),
    marginTop: spacing(0.5),
  },
  orderTotal: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "800",
    color: palette.burgundy,
  },
  orderSettled: { fontFamily: fonts.body, fontSize: 12, color: palette.mutedText },
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
