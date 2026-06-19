import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { fonts, palette } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.burgundy },
          headerTintColor: palette.white,
          headerTitleStyle: {
            fontFamily: fonts.display,
            fontWeight: "700",
            fontSize: 19,
          },
          headerShadowVisible: false,
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: palette.cream },
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
      </Stack>
    </SafeAreaProvider>
  );
}
