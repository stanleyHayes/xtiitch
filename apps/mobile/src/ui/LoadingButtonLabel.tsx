import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { fonts, spacing, type Palette } from "../theme";
import { useTheme } from "../theme-mode";

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

const makeStyles = (_palette: Palette) =>
  StyleSheet.create({
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
  });
