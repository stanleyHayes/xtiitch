import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";

import {
  affiliateApi,
  type AffiliateCampaign,
  type AffiliateConversion,
  type AffiliateDashboard,
  type AffiliatePayout,
  type AffiliateShare,
} from "../../src/affiliateApi";
import { affiliateLogout, loadAffiliateSession } from "../../src/affiliateAuth";
import { formatGHS } from "../../src/api";
import { useTheme } from "../../src/theme-mode";
import { CenterState } from "../../src/ui";
import { makeStyles } from "./index.styles";
import {
  EmptyCopy,
  HeroStat,
  Metric,
  QuickAction,
  SectionHeader,
} from "./overview-components";

type PortalData = {
  dashboard: AffiliateDashboard;
  conversions: AffiliateConversion[];
  payouts: AffiliatePayout[];
  share: AffiliateShare;
  campaigns: AffiliateCampaign[];
};

// eslint-disable-next-line max-lines-per-function -- complete affiliate overview
export default function AffiliatePortalScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [displayName, setDisplayName] = useState("Affiliate");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const session = await loadAffiliateSession();
    if (!session) {
      router.replace("/affiliate/login");
      return;
    }
    setDisplayName(session.account.display_name || "Affiliate");
    const [dashboard, conversions, payouts, share, campaigns] =
      await Promise.all([
        affiliateApi.dashboard(),
        affiliateApi.conversions(),
        affiliateApi.payouts(),
        affiliateApi.share(),
        affiliateApi.campaigns(),
      ]);
    const results = [dashboard, conversions, payouts, share, campaigns];
    if (results.some((result) => !result.ok && result.expired)) {
      router.replace("/affiliate/login");
      return;
    }
    if (
      !dashboard.ok ||
      !conversions.ok ||
      !payouts.ok ||
      !share.ok ||
      !campaigns.ok
    ) {
      setError(
        "We couldn't refresh your affiliate portal. Pull down to try again.",
      );
      return;
    }
    setError("");
    setData({
      dashboard: dashboard.data,
      conversions: conversions.data.conversions,
      payouts: payouts.data.payouts,
      share: share.data,
      campaigns: campaigns.data.campaign_links,
    });
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const signOut = async () => {
    await affiliateLogout();
    router.replace("/affiliate/login");
  };

  if (loading) return <CenterState loading />;
  if (!data)
    return (
      <CenterState
        title="Portal unavailable"
        hint={error || "Try again in a moment."}
        onRetry={() => void load()}
      />
    );

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
      <Stack.Screen
        options={{
          title: "Affiliate",
          headerRight: () => (
            <Pressable onPress={signOut} hitSlop={10}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>AFFILIATE DESK</Text>
            <Text style={styles.heroTitle}>Hello, {displayName}</Text>
            <Text style={styles.heroHint}>
              Your referral performance and available earnings at a glance.
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="sparkles" size={25} color={palette.gold} />
          </View>
        </View>
        <Text style={styles.balanceLabel}>Available commission</Text>
        <Text style={styles.balance}>
          {formatGHS(data.dashboard.available_commission_minor)}
        </Text>
        <View style={styles.heroStats}>
          <HeroStat
            label="Pending"
            value={formatGHS(data.dashboard.pending_commission_minor)}
          />
          <HeroStat
            label="Lifetime"
            value={formatGHS(data.dashboard.lifetime_earnings_minor)}
          />
        </View>
      </View>

      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Performance</Text>
      <View style={styles.metricGrid}>
        <Metric
          icon="eye-outline"
          label="Clicks"
          value={String(data.dashboard.clicks)}
        />
        <Metric
          icon="person-add-outline"
          label="Sign-ups"
          value={String(
            data.dashboard.customer_signups + data.dashboard.business_signups,
          )}
        />
        <Metric
          icon="bag-check-outline"
          label="Purchases"
          value={String(data.dashboard.purchases)}
        />
        <Metric
          icon="analytics-outline"
          label="Purchase rate"
          value={`${(data.dashboard.click_to_purchase_rate_bps / 100).toFixed(1)}%`}
        />
      </View>

      <Text style={styles.sectionTitle}>Your referral link</Text>
      <View style={styles.shareCard}>
        <View style={styles.shareHeading}>
          <View style={styles.shareIcon}>
            <Ionicons name="link" size={21} color={palette.burgundy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shareCode}>{data.share.code}</Text>
            <Text style={styles.shareWindow}>
              {data.share.cookie_window_days}-day attribution window
            </Text>
          </View>
        </View>
        <Text style={styles.url} numberOfLines={2}>
          {data.share.canonical_url}
        </Text>
        <Pressable
          onPress={() =>
            Share.share({
              message: `Discover Xtiitch: ${data.share.canonical_url}`,
            })
          }
          style={({ pressed }) => [
            styles.shareButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="share-outline" size={18} color={palette.onAccent} />
          <Text style={styles.shareButtonText}>Share referral link</Text>
        </Pressable>
      </View>

      <SectionHeader
        title="Recent conversions"
        action="View earnings"
        onPress={() => router.push("/affiliate/earnings")}
      />
      <View style={styles.listCard}>
        {data.conversions.length ? (
          data.conversions.slice(0, 4).map((item, index) => (
            <View
              key={item.conversion_id}
              style={[styles.row, index > 0 && styles.rowBorder]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="arrow-down" size={17} color={palette.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {humanize(item.conversion_type)}
                </Text>
                <Text style={styles.rowMeta}>
                  {new Date(item.occurred_at).toLocaleDateString()} ·{" "}
                  {humanize(item.status)}
                </Text>
              </View>
              <Text style={styles.rowAmount}>
                {formatGHS(item.commission_minor)}
              </Text>
            </View>
          ))
        ) : (
          <EmptyCopy text="Qualified referrals will appear here." />
        )}
      </View>

      <SectionHeader
        title="Campaign links"
        action="Manage"
        onPress={() => router.push("/affiliate/links")}
      />
      <View style={styles.listCard}>
        {data.campaigns.length ? (
          data.campaigns.slice(0, 3).map((campaign, index) => (
            <View
              key={campaign.campaign_link_id}
              style={[styles.row, index > 0 && styles.rowBorder]}
            >
              <View style={styles.rowIcon}>
                <Ionicons
                  name="megaphone-outline"
                  size={17}
                  color={palette.burgundy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{campaign.name}</Text>
                <Text style={styles.rowMeta}>/{campaign.slug}</Text>
              </View>
            </View>
          ))
        ) : (
          <EmptyCopy text="Create a named link to compare channels." />
        )}
      </View>

      <View style={styles.quickGrid}>
        <QuickAction
          icon="wallet-outline"
          title="Payouts"
          subtitle={`${data.payouts.length} records`}
          onPress={() => router.push("/affiliate/earnings")}
        />
        <QuickAction
          icon="settings-outline"
          title="Settings"
          subtitle="Payout & email"
          onPress={() => router.push("/affiliate/settings")}
        />
      </View>
    </ScrollView>
  );
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}
