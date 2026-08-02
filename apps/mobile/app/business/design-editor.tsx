import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { businessApi, type SizeBand } from "../../src/businessApi";
import {
  businessCatalogueApi,
  type CatalogueCollection,
  type DesignInput,
} from "../../src/businessCatalogueApi";
import { useTheme } from "../../src/theme-mode";
import { makeStyles } from "./design-editor.styles";
import { DesignMediaEditor } from "../features/business/catalogue/DesignMediaEditor";
import { DesignVariationsEditor } from "../features/business/catalogue/DesignVariationsEditor";

const categories = [
  "wedding_guest",
  "kente_adire",
  "menswear",
  "ready_to_wear",
  "accessories",
  "bridal",
];
const blank: DesignInput = {
  collection_id: null,
  title: "",
  description: "",
  style_category: "ready_to_wear",
  images: [],
  customisation_allowed: false,
  deposit_override_minor: null,
  bespoke_display_minor: 0,
  sequence: 0,
};
const label = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

// eslint-disable-next-line max-lines-per-function
export default function DesignEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const [form, setForm] = useState<DesignInput>(blank);
  const [bands, setBands] = useState<SizeBand[]>([]);
  const [collections, setCollections] = useState<CatalogueCollection[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(Boolean(id));
  const [error, setError] = useState("");
  const [variations, setVariations] = useState<
    NonNullable<
      import("../../src/businessCatalogueApi").CatalogueDesign["variations"]
    >
  >([]);
  useEffect(() => {
    Promise.all([
      businessApi.sizeBands(),
      businessCatalogueApi.collections(),
      id ? businessCatalogueApi.design(id) : Promise.resolve(null),
    ]).then(([b, c, d]) => {
      if (b.ok) setBands(b.data.size_bands);
      if (c.ok) setCollections(c.data.collections);
      if (d?.ok) {
        const {
          prices: currentPrices = [],
          variations: currentVariations = [],
          ...input
        } = d.data;
        setForm(input);
        setVariations(currentVariations);
        setPrices(
          Object.fromEntries(
            currentPrices.map((p) => [
              p.size_band_id,
              String(p.price_minor / 100),
            ]),
          ),
        );
      }
      setBusy(false);
    });
  }, [id]);
  const field = (
    key: "title" | "description",
    placeholder: string,
    multiline = false,
  ) => (
    <TextInput
      value={form[key]}
      onChangeText={(value) => setForm((old) => ({ ...old, [key]: value }))}
      placeholder={placeholder}
      placeholderTextColor={palette.mutedText}
      multiline={multiline}
      style={[s.input, multiline && s.multiline]}
    />
  );
  const save = async () => {
    setBusy(true);
    setError("");
    const input = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
    };
    const result = id
      ? await businessCatalogueApi.updateDesign(id, input)
      : await businessCatalogueApi.createDesign(input);
    const designId =
      id ??
      (result.ok
        ? (result.data as { design_id?: string }).design_id
        : undefined);
    if (!result.ok || !designId) {
      setBusy(false);
      setError(
        "The design could not be saved. Check the details and your plan limits.",
      );
      return;
    }
    const priceResults = await Promise.all(
      Object.entries(prices).map(([bandId, value]) =>
        businessCatalogueApi.setPrice(
          designId,
          bandId,
          Math.round(Number(value) * 100),
        ),
      ),
    );
    setBusy(false);
    if (priceResults.some((item) => !item.ok)) {
      setError(
        "The design saved, but one or more prices could not be updated.",
      );
      return;
    }
    router.replace("/business/catalogue");
  };
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: id ? "Edit design" : "New design" }} />
      <View style={s.hero}>
        <Ionicons
          name="cut-outline"
          size={145}
          color={palette.onAccent}
          style={s.watermark}
        />
        <Text style={s.eyebrow}>CATALOGUE WORKSHOP</Text>
        <Text style={s.title}>
          {id ? "Refine this piece" : "Create a new piece"}
        </Text>
        <Text style={s.subtitle}>
          Shape the story, selling mode, collection, and prices customers see.
        </Text>
      </View>
      <Text style={s.section}>Photography</Text>
      <View style={s.card}>
        <Text style={s.hint}>
          The first photo becomes the catalogue cover. Add clear front, detail,
          and back views.
        </Text>
        <DesignMediaEditor
          images={form.images}
          onChange={(images) => setForm((old) => ({ ...old, images }))}
          styles={s}
        />
      </View>
      <Text style={s.section}>Design story</Text>
      <View style={s.card}>
        <Text style={s.label}>Title</Text>
        {field("title", "Kente evening dress")}
        <Text style={s.label}>Description</Text>
        {field(
          "description",
          "Materials, fit, finish, and the feeling of the piece",
          true,
        )}
        <Text style={s.label}>Category</Text>
        <View style={s.row}>
          {categories.map((item) => (
            <Pressable
              key={item}
              onPress={() =>
                setForm((old) => ({ ...old, style_category: item }))
              }
              style={[s.chip, form.style_category === item && s.chipActive]}
            >
              <Text
                style={[
                  s.chipText,
                  form.style_category === item && s.chipTextActive,
                ]}
              >
                {label(item)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={s.section}>Selling mode</Text>
      <View style={s.card}>
        <View style={s.switchRow}>
          <View>
            <Text style={s.priceLabel}>Made to measure</Text>
            <Text style={s.hint}>
              Customers request custom sizing and pricing.
            </Text>
          </View>
          <Switch
            value={form.customisation_allowed}
            onValueChange={(value) =>
              setForm((old) => ({ ...old, customisation_allowed: value }))
            }
            trackColor={{ true: palette.burgundy }}
          />
        </View>
        <Text style={s.label}>Collection</Text>
        <View style={s.row}>
          <Pressable
            onPress={() => setForm((old) => ({ ...old, collection_id: null }))}
            style={[s.chip, !form.collection_id && s.chipActive]}
          >
            <Text style={[s.chipText, !form.collection_id && s.chipTextActive]}>
              None
            </Text>
          </Pressable>
          {collections.map((item) => (
            <Pressable
              key={item.collection_id}
              onPress={() =>
                setForm((old) => ({
                  ...old,
                  collection_id: item.collection_id,
                }))
              }
              style={[
                s.chip,
                form.collection_id === item.collection_id && s.chipActive,
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  form.collection_id === item.collection_id && s.chipTextActive,
                ]}
              >
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {!form.customisation_allowed ? (
        <>
          <Text style={s.section}>Size prices</Text>
          <View style={s.card}>
            {bands.map((band) => (
              <View key={band.size_band_id} style={s.priceRow}>
                <Text style={s.priceLabel}>{band.label}</Text>
                <TextInput
                  value={prices[band.size_band_id] ?? ""}
                  onChangeText={(value) =>
                    setPrices((old) => ({
                      ...old,
                      [band.size_band_id]: value.replace(/[^0-9.]/g, ""),
                    }))
                  }
                  placeholder="GHS 0.00"
                  placeholderTextColor={palette.mutedText}
                  keyboardType="decimal-pad"
                  style={[s.input, s.priceInput]}
                />
              </View>
            ))}
            {bands.length === 0 ? (
              <Text style={s.hint}>
                Create size bands in the web studio before pricing ready-to-wear
                pieces.
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
      {id ? (
        <>
          <Text style={s.section}>Colour variations</Text>
          <DesignVariationsEditor
            designId={id}
            initial={variations}
            styles={s}
          />
        </>
      ) : (
        <Text style={s.hint}>
          Save the design once, then reopen it to add colour variations.
        </Text>
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Pressable
        disabled={busy || form.title.trim().length < 2}
        onPress={() => void save()}
        style={[
          s.save,
          (busy || form.title.trim().length < 2) && s.saveDisabled,
        ]}
      >
        <Text style={s.saveText}>{busy ? "Saving…" : "Save design"}</Text>
      </Pressable>
    </ScrollView>
  );
}
