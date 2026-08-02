import { useCallback, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { loadSession } from "../../src/auth";
import {
  businessCatalogueApi,
  type StoreSettings,
} from "../../src/businessCatalogueApi";
import { useTheme } from "../../src/theme-mode";
import { CenterState } from "../../src/ui";
import { makeStyles } from "./store-settings.styles";
import { pickAndUploadDesignImage } from "../../src/businessMedia";
import { DeliveryZonesEditor } from "../features/business/settings/DeliveryZonesEditor";

type ToggleKey = {
  [K in keyof StoreSettings]: StoreSettings[K] extends boolean ? K : never;
}[keyof StoreSettings];
type SettingRow = {
  key: ToggleKey;
  label: string;
  hint: string;
  icon: ComponentProps<typeof Ionicons>["name"];
};
const REQUEST_ROWS: SettingRow[] = [
  {
    key: "bespoke_enabled",
    label: "Bespoke requests",
    hint: "Accept made-to-measure requests.",
    icon: "cut-outline",
  },
  {
    key: "measurements_enabled",
    label: "Self measurements",
    hint: "Accept customer-entered measurements.",
    icon: "resize-outline",
  },
  {
    key: "customisation_enabled",
    label: "Customisation",
    hint: "Let customers request design changes.",
    icon: "color-wand-outline",
  },
  {
    key: "collections_enabled",
    label: "Collections",
    hint: "Group pieces into browsable stories.",
    icon: "albums-outline",
  },
  {
    key: "delivery_enabled",
    label: "Delivery",
    hint: "Offer configured delivery zones.",
    icon: "bicycle-outline",
  },
  {
    key: "dispatch_enabled",
    label: "Dispatch workflow",
    hint: "Track courier dispatch before completion.",
    icon: "navigate-outline",
  },
];
const FEE_ROWS: SettingRow[] = [
  {
    key: "fee_pass_xtiitch_fee",
    label: "Transaction fee",
    hint: "Pass the Xtiitch component to checkout.",
    icon: "receipt-outline",
  },
  {
    key: "fee_pass_paystack_fee",
    label: "Paystack fee",
    hint: "Pass the provider component to checkout.",
    icon: "card-outline",
  },
  {
    key: "fee_pass_tax",
    label: "Tax",
    hint: "Show tax on the customer total.",
    icon: "calculator-outline",
  },
];

export default function StoreSettingsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if (!(await loadSession())) {
      router.replace("/business/login");
      return;
    }
    const result = await businessCatalogueApi.settings();
    if (!result.ok) {
      if (result.expired) router.replace("/business/login");
      else setError("Store settings could not be loaded.");
      return;
    }
    setError("");
    setSettings(result.data);
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const save = async (next: StoreSettings) => {
    if (saving) return;
    const previous = settings;
    setSettings(next);
    setSaving(true);
    const result = await businessCatalogueApi.updateSettings(next);
    setSaving(false);
    if (result.ok) setSettings(result.data);
    else {
      setSettings(previous);
      Alert.alert(
        "Couldn't save setting",
        "The previous value was restored. Try again.",
      );
    }
  };
  if (!settings && !error) return <CenterState loading />;
  if (!settings)
    return (
      <CenterState title="Settings unavailable" hint={error} onRetry={load} />
    );
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Store settings" }} />
      <View style={styles.hero}>
        <Ionicons
          name="options-outline"
          size={145}
          color={palette.onAccent}
          style={styles.watermark}
        />
        <Text style={styles.eyebrow}>STOREFRONT CONTROLS</Text>
        <Text style={styles.title}>Shape the customer journey</Text>
        <Text style={styles.subtitle}>
          Turn on only the services your studio is ready to deliver well.
        </Text>
      </View>
      <SettingsSection
        title="Customer request paths"
        hint="These controls immediately change what customers can request."
        rows={REQUEST_ROWS}
        settings={settings}
        saving={saving}
        onChange={save}
      />
      <Text style={styles.sectionTitle}>Storefront layout</Text>
      <Text style={styles.sectionHint}>
        Choose the composition used by your public storefront.
      </Text>
      <View style={styles.layouts}>
        {["standard", "spotlight", "minimal"].map((layout) => {
          const active = settings.layout_variant === layout;
          return (
            <Pressable
              key={layout}
              disabled={saving}
              onPress={() => void save({ ...settings, layout_variant: layout })}
              style={[styles.layout, active && styles.layoutActive]}
            >
              <Text
                style={[styles.layoutText, active && styles.layoutTextActive]}
              >
                {layout}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <BrandAssetsEditor settings={settings} saving={saving} onChange={save} />
      <DeliveryZonesEditor />
      <SettingsSection
        title="Checkout fees"
        hint="Choose which supported costs appear on the customer's total."
        rows={FEE_ROWS}
        settings={settings}
        saving={saving}
        onChange={save}
      />
      {saving ? (
        <View style={styles.saving}>
          <ActivityIndicator size="small" color={palette.burgundy} />
          <Text style={styles.savingText}>Saving changes…</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function BrandAssetsEditor({
  settings,
  saving,
  onChange,
}: {
  settings: StoreSettings;
  saving: boolean;
  onChange: (next: StoreSettings) => Promise<void>;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [brandColour, setBrandColour] = useState(settings.brand_color);
  const upload = async (key: "logo_url" | "banner_url") => {
    const result = await pickAndUploadDesignImage();
    if (result.ok) await onChange({ ...settings, [key]: result.url });
    else if (result.error !== "cancelled") Alert.alert("Couldn’t upload image");
  };
  return (
    <>
      <Text style={styles.sectionTitle}>Brand identity</Text>
      <Text style={styles.sectionHint}>
        Carry your studio colour, logo, and campaign banner into the public
        shop.
      </Text>
      <View style={styles.brandPanel}>
        <Text style={styles.label}>Brand colour</Text>
        <View style={styles.brandColourRow}>
          <View
            style={[
              styles.brandSwatch,
              {
                backgroundColor: /^#[0-9a-f]{6}$/i.test(brandColour)
                  ? brandColour
                  : palette.burgundy,
              },
            ]}
          />
          <TextInput
            value={brandColour}
            onChangeText={setBrandColour}
            placeholder="#800020"
            placeholderTextColor={palette.mutedText}
            autoCapitalize="characters"
            style={styles.brandInput}
          />
          <Pressable
            disabled={saving || !/^#[0-9a-f]{6}$/i.test(brandColour)}
            onPress={() =>
              void onChange({ ...settings, brand_color: brandColour })
            }
            style={styles.brandSave}
          >
            <Text style={styles.brandSaveText}>Save</Text>
          </Pressable>
        </View>
        <View style={styles.assetRow}>
          {(["logo_url", "banner_url"] as const).map((key) => (
            <Pressable
              key={key}
              disabled={saving}
              onPress={() => void upload(key)}
              style={styles.assetButton}
            >
              {settings[key] ? (
                <Image
                  source={{ uri: settings[key] }}
                  style={styles.assetImage}
                />
              ) : (
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={palette.burgundy}
                />
              )}
              <Text style={styles.assetLabel}>
                {key === "logo_url" ? "Studio logo" : "Store banner"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

function SettingsSection({
  title,
  hint,
  rows,
  settings,
  saving,
  onChange,
}: {
  title: string;
  hint: string;
  rows: SettingRow[];
  settings: StoreSettings;
  saving: boolean;
  onChange: (next: StoreSettings) => Promise<void>;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
      <View style={styles.panel}>
        {rows.map((item, index) => (
          <View
            key={item.key}
            style={[styles.row, index === rows.length - 1 && styles.rowLast]}
          >
            <View style={styles.icon}>
              <Ionicons name={item.icon} size={20} color={palette.burgundy} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.hint}>{item.hint}</Text>
            </View>
            <Switch
              value={settings[item.key]}
              onValueChange={(value) =>
                void onChange({ ...settings, [item.key]: value })
              }
              disabled={saving}
              trackColor={{ false: palette.softBorder, true: palette.burgundy }}
              thumbColor={palette.onAccent}
            />
          </View>
        ))}
      </View>
    </>
  );
}
