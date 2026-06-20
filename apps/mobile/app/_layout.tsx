import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BrandingProvider } from "../src/branding";
import { fonts } from "../src/theme";
import { ThemeModeProvider, ThemeToggle, useTheme } from "../src/theme-mode";
import { HeaderLogo } from "../src/ui";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BrandingProvider>
        <ThemeModeProvider>
          <StatusBar style="light" />
          <ThemedStack />
        </ThemeModeProvider>
      </BrandingProvider>
    </SafeAreaProvider>
  );
}

function ThemedStack() {
  const { palette } = useTheme();
  return (
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.burgundy },
          headerTintColor: palette.onAccent,
          headerTitleStyle: {
            fontFamily: fonts.display,
            fontWeight: "700",
            fontSize: 19,
          },
          headerShadowVisible: false,
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: palette.cream },
          headerTitle: () => <HeaderLogo color={palette.onAccent} />,
          headerTitleAlign: "center",
          headerRight: () => <ThemeToggle />,
          // Consistent native stack transition across all platforms so the
          // brand reveal feels intentional rather than platform-default flicker.
          animation: "slide_from_right",
          animationDuration: 260,
        }}
      >
        <Stack.Screen name="index" options={{ title: "Xtiitch" }} />
        <Stack.Screen name="store/[handle]" options={{ title: "Store" }} />
        <Stack.Screen name="design/[handle]" options={{ title: "Design" }} />
        <Stack.Screen name="track/[id]" options={{ title: "Track order" }} />
        <Stack.Screen name="business/login" options={{ title: "Studio sign-in" }} />
        <Stack.Screen name="business/index" options={{ title: "Studio" }} />
        <Stack.Screen name="business/orders" options={{ title: "Orders" }} />
        <Stack.Screen name="business/order/[id]" options={{ title: "Order" }} />
        <Stack.Screen name="business/new-order" options={{ title: "New order" }} />
      </Stack>
  );
}
