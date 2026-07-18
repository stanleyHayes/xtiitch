import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, radius, spacing, type Palette } from "../theme";
import { useTheme } from "../theme-mode";
import { SkeletonBlock } from "./SkeletonBlock";

export function CenterState({
  loading,
  title,
  hint,
  retryLabel,
  onRetry,
}: {
  loading?: boolean;
  title?: string;
  hint?: string;
  retryLabel?: string;
  onRetry?: () => void;
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
          {onRetry ? (
            <Pressable onPress={onRetry} style={styles.retry} hitSlop={8}>
              <Text style={styles.retryText}>{retryLabel ?? "Retry"}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
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
    retry: {
      marginTop: spacing(1.5),
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(3),
      paddingVertical: spacing(1.25),
    },
    retryText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
  });
