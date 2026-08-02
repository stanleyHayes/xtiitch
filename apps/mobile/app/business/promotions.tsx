import { useCallback, useState, useMemo } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { loadSession } from "../../src/auth";
import { businessApi, type BusinessDesign } from "../../src/businessApi";
import {
  businessAdminApi,
  type BusinessPromotion,
  type PromotionBody,
} from "../../src/businessAdminApi";
import { CenterState } from "../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { CreatePromotionCard } from "../features/business/promotions/CreatePromotionCard";
import { PromotionRow } from "../features/business/promotions/PromotionRow";

// The update endpoint replaces the whole promotion (like the web dashboard),
// so pause/resume re-sends every field exactly as stored and flips only the
// status. Empty string means "no date" for starts_at/ends_at.
function fullBodyFrom(
  promo: BusinessPromotion,
  status: PromotionBody["status"],
): PromotionBody {
  return {
    code: promo.code,
    title: promo.title,
    description: promo.description,
    discount_type: promo.discount_type as PromotionBody["discount_type"],
    discount_value: promo.discount_value,
    max_discount_minor: promo.max_discount_minor,
    min_spend_minor: promo.min_spend_minor,
    usage_limit_global: promo.usage_limit_global,
    usage_limit_per_customer: promo.usage_limit_per_customer,
    scope: promo.scope as PromotionBody["scope"],
    target_collection_id: promo.target_collection_id,
    target_design_id: promo.target_design_id,
    status,
    starts_at: promo.starts_at ?? "",
    ends_at: promo.ends_at ?? "",
  };
}

// eslint-disable-next-line max-lines-per-function -- complete promotions workspace
export default function BusinessPromotionsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [promotions, setPromotions] = useState<BusinessPromotion[] | null>(
    null,
  );
  const [designs, setDesigns] = useState<BusinessDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toLogin = useCallback(() => {
    router.replace("/business/login");
  }, [router]);

  const fetchData = useCallback(async () => {
    const [promosResult, designsResult] = await Promise.all([
      businessAdminApi.promotions(),
      businessApi.designs(),
    ]);
    if (
      (!promosResult.ok && promosResult.expired) ||
      (!designsResult.ok && designsResult.expired)
    ) {
      toLogin();
      return;
    }
    if (promosResult.ok) {
      setFetchError(false);
      setPromotions(promosResult.data.promotions);
    } else {
      setFetchError(true);
    }
    if (designsResult.ok) {
      setDesigns(
        designsResult.data.designs.filter(
          (design: BusinessDesign) => design.status === "active",
        ),
      );
    }
  }, [toLogin]);

  // Guard the route and load on focus so a fresh login lands here populated.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((current) => {
        if (!active) return;
        if (!current) {
          toLogin();
          return;
        }
        fetchData().finally(() => {
          if (active) setLoading(false);
        });
      });
      return () => {
        active = false;
      };
    }, [fetchData, toLogin]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    void fetchData().finally(() => setLoading(false));
  };

  const toggleStatus = async (promo: BusinessPromotion) => {
    const next = promo.status === "active" ? "paused" : "active";
    setBusyId(promo.promotion_id);
    const result = await businessAdminApi.updatePromotion(
      promo.promotion_id,
      fullBodyFrom(promo, next),
    );
    setBusyId(null);
    if (result.ok) {
      await fetchData();
    } else if (result.expired) {
      toLogin();
    } else {
      Alert.alert(
        "Couldn't update promotion",
        "Check your connection and try again.",
      );
    }
  };

  const archive = (promo: BusinessPromotion) => {
    Alert.alert(
      "Archive promotion",
      `Archive ${promo.code}? Customers will no longer be able to use it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyId(promo.promotion_id);
              const result = await businessAdminApi.archivePromotion(
                promo.promotion_id,
              );
              setBusyId(null);
              if (result.ok) {
                await fetchData();
              } else if (result.expired) {
                toLogin();
              } else {
                Alert.alert(
                  "Couldn't archive promotion",
                  "Check your connection and try again.",
                );
              }
            })();
          },
        },
      ],
    );
  };

  if (loading) return <CenterState loading />;

  if (fetchError && promotions === null) {
    return (
      <CenterState
        title="Couldn't load promotions"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  const list = promotions ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.burgundy}
        />
      }
    >
      <Stack.Screen options={{ title: "Promotions" }} />

      <CreatePromotionCard
        designs={designs}
        onCreated={() => void fetchData()}
        onSessionExpired={toLogin}
      />

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Promotions</Text>
      </View>

      {list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No promotions yet</Text>
          <Text style={styles.emptyHint}>
            Create a discount code above to reward your customers.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((promo) => (
            <PromotionRow
              key={promo.promotion_id}
              promo={promo}
              busy={busyId === promo.promotion_id}
              onToggleStatus={() => void toggleStatus(promo)}
              onArchive={() => archive(promo)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    sectionHead: {
      marginTop: spacing(3.5),
      marginBottom: spacing(1.5),
    },
    sectionLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: palette.mutedText,
    },
    list: { gap: spacing(1.5) },
    empty: {
      backgroundColor: palette.panel,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(3),
      alignItems: "center",
    },
    emptyTitle: { fontFamily: fonts.display, fontSize: 18, color: palette.ink },
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      textAlign: "center",
      marginTop: spacing(0.75),
      lineHeight: 20,
    },
  });
