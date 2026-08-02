import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export async function getSessionValue(key: string): Promise<string | null> {
  if (!isNative) return AsyncStorage.getItem(key);
  const secure = await SecureStore.getItemAsync(key);
  if (secure) return secure;
  // One-time upgrade path from the pre-SecureStore builds.
  const legacy = await AsyncStorage.getItem(key);
  if (legacy) {
    await SecureStore.setItemAsync(key, legacy, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await AsyncStorage.removeItem(key);
  }
  return legacy;
}

export async function setSessionValue(
  key: string,
  value: string,
): Promise<void> {
  if (!isNative) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await AsyncStorage.removeItem(key);
}

export async function deleteSessionValue(key: string): Promise<void> {
  if (!isNative) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(key),
    AsyncStorage.removeItem(key),
  ]);
}
