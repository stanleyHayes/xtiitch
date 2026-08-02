import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { loadSession } from "../../src/auth";
import {
  businessCatalogueApi,
  type CatalogueCollection,
  type CatalogueDesign,
} from "../../src/businessCatalogueApi";
import { useTheme } from "../../src/theme-mode";
import { CenterState } from "../../src/ui";
import { makeStyles } from "./catalogue.styles";

export default function CatalogueScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [designs, setDesigns] = useState<CatalogueDesign[] | null>(null);
  const [collections, setCollections] = useState<CatalogueCollection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const session = await loadSession();
    if (!session) {
      router.replace("/business/login");
      return;
    }
    const [designResult, collectionResult] = await Promise.all([
      businessCatalogueApi.designs(),
      businessCatalogueApi.collections(),
    ]);
    if (
      (!designResult.ok && designResult.expired) ||
      (!collectionResult.ok && collectionResult.expired)
    ) {
      router.replace("/business/login");
      return;
    }
    if (!designResult.ok) {
      setError("Catalogue could not be loaded.");
      return;
    }
    setError("");
    setDesigns(designResult.data.designs);
    if (collectionResult.ok) setCollections(collectionResult.data.collections);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (designs === null && !error) return <CenterState loading />;
  if (designs === null)
    return (
      <CenterState title="Catalogue unavailable" hint={error} onRetry={load} />
    );

  const activeCount = designs.filter((item) => item.status === "active").length;
  const picturedCount = designs.filter((item) => item.images.length > 0).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={palette.burgundy}
        />
      }
    >
      <Stack.Screen options={{ title: "Catalogue" }} />
      <View style={styles.hero}>
        <Ionicons
          name="shirt-outline"
          size={150}
          color={palette.onAccent}
          style={styles.watermark}
        />
        <Text style={styles.eyebrow}>YOUR SHOP FLOOR</Text>
        <Text style={styles.title}>Catalogue studio</Text>
        <Text style={styles.subtitle}>
          See what customers can buy and keep retired work separate from the
          live rail.
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/business/design-editor")}
        style={styles.primaryAction}
      >
        <Ionicons name="add" size={20} color={palette.onAccent} />
        <Text style={styles.primaryActionText}>Create a design</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push("/business/collections")}
        style={styles.secondaryAction}
      >
        <Ionicons name="albums-outline" size={18} color={palette.burgundy} />
        <Text style={styles.secondaryActionText}>Manage collections</Text>
      </Pressable>
      <View style={styles.statRow}>
        <Stat value={String(activeCount)} label="Live designs" />
        <Stat
          value={String(
            collections.filter((item) => item.status === "active").length,
          )}
          label="Collections"
        />
        <Stat
          value={`${picturedCount}/${designs.length}`}
          label="With imagery"
        />
      </View>
      {collections.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Collections</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.collectionRow}
          >
            {collections.map((item) => (
              <View
                key={item.collection_id}
                style={[
                  styles.collectionChip,
                  item.status !== "active" && styles.collectionChipRetired,
                ]}
              >
                <Text style={styles.collectionText}>{item.name}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
      <Text style={styles.sectionTitle}>All designs</Text>
      {designs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shirt-outline" size={36} color={palette.burgundy} />
          <Text style={styles.emptyTitle}>No designs yet</Text>
          <Text style={styles.emptyHint}>
            Create your first piece here, then set prices for every size.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {designs.map((design) => (
            <DesignCard
              key={design.design_id}
              design={design}
              onChanged={load}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DesignCard({
  design,
  onChanged,
}: {
  design: CatalogueDesign;
  onChanged: () => Promise<void>;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const retired = design.status !== "active";
  const router = useRouter();
  const changeStatus = () =>
    Alert.alert(
      retired ? "Restore design?" : "Retire design?",
      retired
        ? "This returns the piece to the live catalogue."
        : "Customers will no longer see this piece, but its history remains.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: retired ? "Restore" : "Retire",
          style: retired ? "default" : "destructive",
          onPress: async () => {
            const result = retired
              ? await businessCatalogueApi.restoreDesign(design.design_id)
              : await businessCatalogueApi.retireDesign(design.design_id);
            if (result.ok) await onChanged();
            else
              Alert.alert(
                "Couldn't update design",
                "Check your connection and try again.",
              );
          },
        },
      ],
    );
  const remove = () =>
    Alert.alert(
      "Delete design permanently?",
      `${design.title} and its catalogue pricing cannot be recovered. Existing order history is kept.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await businessCatalogueApi.deleteDesign(
              design.design_id,
            );
            if (result.ok) await onChanged();
            else Alert.alert("Couldn't delete design", "Try again shortly.");
          },
        },
      ],
    );
  return (
    <View style={styles.card}>
      {design.images[0] ? (
        <Image source={{ uri: design.images[0] }} style={styles.image} />
      ) : (
        <View style={styles.imageFallback}>
          <Ionicons name="image-outline" size={28} color={palette.mauve} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {design.title}
          </Text>
          <View style={[styles.status, retired && styles.statusRetired]}>
            <Text style={styles.statusText}>{design.status}</Text>
          </View>
        </View>
        <Text style={styles.meta} numberOfLines={2}>
          {design.style_category || "Uncategorised"}
          {design.customisation_allowed ? " · Customisable" : ""}
        </Text>
        <View style={styles.cardActions}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/business/design-editor",
                params: { id: design.design_id },
              })
            }
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={changeStatus}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>
              {retired ? "Restore" : "Retire"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Delete ${design.title}`}
            onPress={remove}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={16} color={palette.danger} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
