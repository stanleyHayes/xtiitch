import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  Fraunces_700Bold,
  Fraunces_800ExtraBold,
  Fraunces_900Black,
} from "@expo-google-fonts/fraunces";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from "@expo-google-fonts/outfit";

import { BrandingProvider } from "../src/branding";
import { fonts } from "../src/theme";
import { ThemeModeProvider, ThemeToggle, useTheme } from "../src/theme-mode";
import { HeaderLogo } from "../src/ui";
import { authedFetch, loadSession } from "../src/auth";
import {
  configureNotificationPresentation,
  ensureAndroidNotificationChannels,
  notificationOrderId,
  registerBusinessPushNotifications,
} from "../src/push-notifications";

configureNotificationPresentation();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_700Bold,
    Fraunces_800ExtraBold,
    Fraunces_900Black,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <BrandingProvider>
        <ThemeModeProvider>
          <ThemedStack />
        </ThemeModeProvider>
      </BrandingProvider>
    </SafeAreaProvider>
  );
}

function ThemedStack() {
  const { palette } = useTheme();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void ensureAndroidNotificationChannels();
    void loadSession().then((session) => {
      if (active && session)
        void registerBusinessPushNotifications(authedFetch);
    });

    const openOrder = (response: Notifications.NotificationResponse) => {
      const orderId = notificationOrderId(response);
      if (orderId)
        router.push(`/business/order/${encodeURIComponent(orderId)}`);
    };
    const subscription =
      Notifications.addNotificationResponseReceivedListener(openOrder);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (active && response) openOrder(response);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.burgundyDeep },
          headerTintColor: palette.onAccent,
          headerTitleStyle: {
            fontFamily: fonts.display,
            fontWeight: "700",
            fontSize: 18,
          },
          headerShadowVisible: false,
          headerBackTitle: "",
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: palette.cream },
          headerTitle: () => <HeaderLogo color={palette.onAccent} />,
          headerTitleAlign: "center",
          headerRight: () => <HeaderActions />,
          // Consistent native stack transition across all platforms so the
          // brand reveal feels intentional rather than platform-default flicker.
          animation: "slide_from_right",
          animationDuration: Platform.OS === "android" ? 220 : 280,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" options={{ title: "Xtiitch" }} />
        <Stack.Screen name="store/[handle]" options={{ title: "Store" }} />
        <Stack.Screen name="design/[handle]" options={{ title: "Design" }} />
        <Stack.Screen name="track/[id]" options={{ title: "Track order" }} />
        <Stack.Screen name="cart" options={{ title: "Basket" }} />
        <Stack.Screen
          name="business/login"
          options={{ title: "Studio sign-in" }}
        />
        <Stack.Screen
          name="business/register"
          options={{ title: "Create your store" }}
        />
        <Stack.Screen
          name="business/forgot-password"
          options={{ title: "Reset access" }}
        />
        <Stack.Screen name="business/index" options={{ title: "Studio" }} />
        <Stack.Screen name="business/orders" options={{ title: "Orders" }} />
        <Stack.Screen
          name="business/catalogue"
          options={{ title: "Catalogue" }}
        />
        <Stack.Screen
          name="business/design-editor"
          options={{ title: "Design editor" }}
        />
        <Stack.Screen
          name="business/collections"
          options={{ title: "Collections" }}
        />
        <Stack.Screen
          name="business/store-settings"
          options={{ title: "Store settings" }}
        />
        <Stack.Screen
          name="business/measurements"
          options={{ title: "Measurements" }}
        />
        <Stack.Screen name="business/size-bands" options={{ title: "Sizes" }} />
        <Stack.Screen name="business/reports" options={{ title: "Reports" }} />
        <Stack.Screen name="business/account" options={{ title: "Account" }} />
        <Stack.Screen name="business/billing" options={{ title: "Plans" }} />
        <Stack.Screen name="business/help" options={{ title: "Help" }} />
        <Stack.Screen
          name="business/affiliates"
          options={{ title: "Creator partnerships" }}
        />
        <Stack.Screen name="business/order/[id]" options={{ title: "Order" }} />
        <Stack.Screen
          name="business/new-order"
          options={{ title: "New order" }}
        />
        <Stack.Screen
          name="affiliate/login"
          options={{ title: "Affiliate sign-in" }}
        />
        <Stack.Screen
          name="affiliate/recovery"
          options={{ title: "Affiliate recovery" }}
        />
        <Stack.Screen name="affiliate/index" options={{ title: "Affiliate" }} />
        <Stack.Screen
          name="affiliate/earnings"
          options={{ title: "Earnings" }}
        />
        <Stack.Screen
          name="affiliate/links"
          options={{ title: "Campaign links" }}
        />
        <Stack.Screen
          name="affiliate/settings"
          options={{ title: "Affiliate settings" }}
        />
      </Stack>
    </>
  );
}

function HeaderActions() {
  const { palette } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const operational = segments[0] === "business" || segments[0] === "affiliate";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {!operational ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open basket"
          onPress={() => router.push("/cart")}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed
              ? "rgba(255,255,255,0.20)"
              : "rgba(255,255,255,0.10)",
          })}
        >
          <Ionicons
            name="bag-handle-outline"
            size={20}
            color={palette.onAccent}
          />
        </Pressable>
      ) : null}
      <ThemeToggle />
    </View>
  );
}
