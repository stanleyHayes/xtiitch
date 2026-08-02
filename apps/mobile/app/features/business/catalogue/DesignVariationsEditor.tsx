import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import {
  businessCatalogueApi,
  type DesignVariation,
} from "../../../../src/businessCatalogueApi";
import type { makeStyles } from "../../../business/design-editor.styles";
import { DesignMediaEditor } from "./DesignMediaEditor";

type Styles = ReturnType<typeof makeStyles>;

// Variation lifecycle, media, default selection, and ordering intentionally
// share one editor so each command updates the same local ordered list.
// eslint-disable-next-line max-lines-per-function
export function DesignVariationsEditor({
  designId,
  initial,
  styles,
}: {
  designId: string;
  initial: DesignVariation[];
  styles: Styles;
}) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draftName, setDraftName] = useState("");
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const input = {
      name: name.trim(),
      images: [],
      is_default: items.length === 0,
      sequence: items.length,
    };
    const result = await businessCatalogueApi.createVariation(designId, input);
    setBusy(false);
    if (result.ok) {
      setItems([
        ...items,
        { ...input, variation_id: result.data.variation_id },
      ]);
      setName("");
    } else
      Alert.alert(
        "Couldn’t add variation",
        "Your plan limit may have been reached.",
      );
  };
  const remove = (item: DesignVariation) =>
    Alert.alert(
      "Remove variation?",
      `${item.name} will no longer appear on this design.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const result = await businessCatalogueApi.deleteVariation(
              designId,
              item.variation_id,
            );
            if (result.ok)
              setItems(
                items.filter(
                  (entry) => entry.variation_id !== item.variation_id,
                ),
              );
          },
        },
      ],
    );
  const update = async (item: DesignVariation, next: DesignVariation) => {
    const result = await businessCatalogueApi.updateVariation(
      designId,
      item.variation_id,
      {
        name: next.name,
        images: next.images,
        is_default: next.is_default,
        sequence: next.sequence,
      },
    );
    if (result.ok) {
      setItems(
        items.map((entry) =>
          entry.variation_id === item.variation_id
            ? next
            : next.is_default
              ? { ...entry, is_default: false }
              : entry,
        ),
      );
      return true;
    }
    Alert.alert(
      "Couldn’t update variation",
      "Check the details and try again.",
    );
    return false;
  };
  const move = async (item: DesignVariation, offset: -1 | 1) => {
    const index = items.findIndex(
      (entry) => entry.variation_id === item.variation_id,
    );
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const ordered = [...items];
    const moving = ordered[index];
    const displaced = ordered[target];
    if (!moving || !displaced) return;
    ordered[index] = displaced;
    ordered[target] = moving;
    const result = await businessCatalogueApi.reorderVariations(
      designId,
      ordered.map((entry) => entry.variation_id),
    );
    if (result.ok) {
      setItems(ordered.map((entry, sequence) => ({ ...entry, sequence })));
    }
  };
  return (
    <View style={styles.card}>
      {items.map((item) => (
        <View key={item.variation_id} style={styles.variationCard}>
          <View style={styles.variationRow}>
            <View style={styles.variationSwatch} />
            <View style={styles.variationCopy}>
              <Text style={styles.priceLabel}>{item.name}</Text>
              <Text style={styles.hint}>
                {item.is_default
                  ? "Default colour"
                  : `Variation ${item.sequence + 1}`}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setEditingId(
                  editingId === item.variation_id ? "" : item.variation_id,
                );
                setDraftName(item.name);
              }}
              style={styles.smallAction}
            >
              <Text style={styles.smallActionText}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Move ${item.name} up`}
              onPress={() => void move(item, -1)}
              style={styles.iconAction}
            >
              <Text style={styles.smallActionText}>↑</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Move ${item.name} down`}
              onPress={() => void move(item, 1)}
              style={styles.iconAction}
            >
              <Text style={styles.smallActionText}>↓</Text>
            </Pressable>
            <Pressable onPress={() => remove(item)} style={styles.smallAction}>
              <Text style={styles.smallActionText}>Remove</Text>
            </Pressable>
          </View>
          {editingId === item.variation_id ? (
            <>
              <View style={styles.priceRow}>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  style={[styles.input, styles.variationInput]}
                />
                <Pressable
                  onPress={() => {
                    void update(item, { ...item, name: draftName.trim() }).then(
                      (saved) => saved && setEditingId(""),
                    );
                  }}
                  style={styles.smallAction}
                >
                  <Text style={styles.smallActionText}>Save name</Text>
                </Pressable>
              </View>
              <DesignMediaEditor
                images={item.images}
                onChange={(images) => void update(item, { ...item, images })}
                styles={styles}
              />
              {!item.is_default ? (
                <Pressable
                  onPress={() =>
                    void update(item, { ...item, is_default: true })
                  }
                  style={styles.smallAction}
                >
                  <Text style={styles.smallActionText}>
                    Make default colour
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>
      ))}
      <View style={styles.priceRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="New colour or finish"
          style={[styles.input, styles.variationInput]}
        />
        <Pressable
          disabled={busy || !name.trim()}
          onPress={() => void add()}
          style={styles.smallAction}
        >
          <Text style={styles.smallActionText}>{busy ? "Adding…" : "Add"}</Text>
        </Pressable>
      </View>
    </View>
  );
}
