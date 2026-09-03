// Parked future product-Affiliate surface. Kept outside Expo's app/ route tree
// so it cannot open until the commercial model is deliberately redesigned.
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect } from "expo-router";
import {
  businessAffiliatesApi,
  type AffiliateAttribution,
  type BusinessAffiliate,
  type BusinessAffiliateProgramme,
} from "../businessAffiliatesApi";
import { formatGHS } from "../api";
import { useTheme } from "../theme-mode";
import { styles } from "./business-affiliates.styles";

// The coordinator keeps the three related datasets and edit forms synchronized;
// visual styling is isolated in affiliates.styles.ts.
// eslint-disable-next-line max-lines-per-function
export default function BusinessAffiliatesScreen() {
  const { palette } = useTheme();
  const s = useMemo(() => styles(palette), [palette]);
  const [programmes, setProgrammes] = useState<BusinessAffiliateProgramme[]>(
    [],
  );
  const [affiliates, setAffiliates] = useState<BusinessAffiliate[]>([]);
  const [attribution, setAttribution] = useState<AffiliateAttribution[]>([]);
  const [programmeName, setProgrammeName] = useState("");
  const [programmeRate, setProgrammeRate] = useState("5");
  const [editingProgramme, setEditingProgramme] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [code, setCode] = useState("");
  const [selectedProgramme, setSelectedProgramme] = useState("");
  const [editingAffiliate, setEditingAffiliate] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [p, a, x] = await Promise.all([
      businessAffiliatesApi.programmes(),
      businessAffiliatesApi.affiliates(),
      businessAffiliatesApi.attribution(),
    ]);
    if (p.ok) {
      setProgrammes(p.data.programmes);
      setSelectedProgramme(
        (current) =>
          current || p.data.programmes[0]?.affiliate_programme_id || "",
      );
    }
    if (a.ok) setAffiliates(a.data.affiliates);
    if (x.ok) setAttribution(x.data.attribution);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const createProgramme = async () => {
    if (!programmeName.trim()) return;
    setBusy(true);
    const rate = Math.round(Number(programmeRate) * 100);
    const input = {
      name: programmeName.trim(),
      description: "Creator purchase commission programme",
      status: "active",
      default_purchase_commission_bps: rate,
      default_first_paid_plan_commission_bps: 0,
      cookie_window_days: 30,
      hold_days: 14,
      payout_mode: "manual",
      minimum_payout_minor: 0,
      allowed_target_scope: "store",
    };
    const result = editingProgramme
      ? await businessAffiliatesApi.updateProgramme(editingProgramme, input)
      : await businessAffiliatesApi.createProgramme(input);
    setBusy(false);
    if (result.ok) {
      setProgrammeName("");
      setProgrammeRate("5");
      setEditingProgramme("");
      await load();
    } else
      Alert.alert(
        "Couldn’t create programme",
        "Check the rate and your access.",
      );
  };
  const createAffiliate = async () => {
    if (
      !selectedProgramme ||
      !partnerName.trim() ||
      !partnerEmail.trim() ||
      !code.trim()
    )
      return;
    const programme = programmes.find(
      (item) => item.affiliate_programme_id === selectedProgramme,
    );
    setBusy(true);
    const input = {
      affiliate_programme_id: selectedProgramme,
      code: code.trim().toUpperCase(),
      display_name: partnerName.trim(),
      contact_name: partnerName.trim(),
      email: partnerEmail.trim(),
      phone: "",
      purchase_commission_bps:
        programme?.default_purchase_commission_bps ?? 500,
      first_paid_plan_commission_bps: 0,
      cookie_window_days: programme?.cookie_window_days ?? 30,
      status: "active",
      target_scope: "store",
      target_ref_id: undefined,
    };
    const result = editingAffiliate
      ? await businessAffiliatesApi.updateAffiliate(editingAffiliate, input)
      : await businessAffiliatesApi.createAffiliate(input);
    setBusy(false);
    if (result.ok) {
      setPartnerName("");
      setPartnerEmail("");
      setCode("");
      setEditingAffiliate("");
      await load();
    } else
      Alert.alert(
        "Couldn’t add affiliate",
        "Check the code, email, and programme.",
      );
  };
  const metric = (affiliate: BusinessAffiliate) =>
    attribution.find((item) => item.affiliate_id === affiliate.affiliate_id);
  const editProgramme = (item: BusinessAffiliateProgramme) => {
    setEditingProgramme(item.affiliate_programme_id);
    setProgrammeName(item.name);
    setProgrammeRate(String(item.default_purchase_commission_bps / 100));
  };
  const editAffiliate = (item: BusinessAffiliate) => {
    setEditingAffiliate(item.affiliate_id);
    setSelectedProgramme(item.affiliate_programme_id);
    setPartnerName(item.display_name);
    setPartnerEmail(item.email);
    setCode(item.code);
  };
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Creator partnerships" }} />
      <View style={s.hero}>
        <Ionicons
          name="megaphone-outline"
          size={145}
          color={palette.onAccent}
          style={s.watermark}
        />
        <Text style={s.eyebrow}>GROW WITH CREATORS</Text>
        <Text style={s.title}>Affiliate partnerships</Text>
        <Text style={s.subtitle}>
          Create commission programmes, issue trackable codes, and follow
          attributed sales.
        </Text>
      </View>
      <Text style={s.section}>
        {editingProgramme ? "Edit programme" : "New programme"}
      </Text>
      <View style={s.card}>
        <TextInput
          value={programmeName}
          onChangeText={setProgrammeName}
          placeholder="Programme name"
          placeholderTextColor={palette.mutedText}
          style={s.input}
        />
        <TextInput
          value={programmeRate}
          onChangeText={setProgrammeRate}
          placeholder="Purchase commission %"
          placeholderTextColor={palette.mutedText}
          keyboardType="decimal-pad"
          style={s.input}
        />
        <Pressable
          disabled={busy || !programmeName.trim()}
          onPress={() => void createProgramme()}
          style={s.primary}
        >
          <Text style={s.primaryText}>
            {editingProgramme ? "Save programme" : "Create programme"}
          </Text>
        </Pressable>
        {editingProgramme ? (
          <Pressable
            onPress={() => {
              setEditingProgramme("");
              setProgrammeName("");
              setProgrammeRate("5");
            }}
            style={s.secondary}
          >
            <Text style={s.secondaryText}>Cancel editing</Text>
          </Pressable>
        ) : null}
      </View>
      {programmes.map((item) => (
        <View key={item.affiliate_programme_id} style={s.programmeRow}>
          <View style={s.copy}>
            <Text style={s.cardTitle}>{item.name}</Text>
            <Text style={s.hint}>
              {item.default_purchase_commission_bps / 100}% ·{" "}
              {item.affiliate_count} creators
            </Text>
          </View>
          <Pressable onPress={() => editProgramme(item)} style={s.secondary}>
            <Text style={s.secondaryText}>Edit</Text>
          </Pressable>
        </View>
      ))}
      {programmes.length ? (
        <>
          <Text style={s.section}>Add a creator</Text>
          <View style={s.card}>
            <View style={s.chips}>
              {programmes.map((item) => (
                <Pressable
                  key={item.affiliate_programme_id}
                  onPress={() =>
                    setSelectedProgramme(item.affiliate_programme_id)
                  }
                  style={[
                    s.chip,
                    selectedProgramme === item.affiliate_programme_id &&
                      s.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      s.chipText,
                      selectedProgramme === item.affiliate_programme_id &&
                        s.chipTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={partnerName}
              onChangeText={setPartnerName}
              placeholder="Creator display name"
              placeholderTextColor={palette.mutedText}
              style={s.input}
            />
            <TextInput
              value={partnerEmail}
              onChangeText={setPartnerEmail}
              placeholder="Creator email"
              placeholderTextColor={palette.mutedText}
              autoCapitalize="none"
              keyboardType="email-address"
              style={s.input}
            />
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Tracking code, e.g. AMA10"
              placeholderTextColor={palette.mutedText}
              autoCapitalize="characters"
              style={s.input}
            />
            <Pressable
              disabled={busy || !partnerName || !partnerEmail || !code}
              onPress={() => void createAffiliate()}
              style={s.primary}
            >
              <Text style={s.primaryText}>
                {editingAffiliate ? "Save affiliate" : "Add affiliate"}
              </Text>
            </Pressable>
            {editingAffiliate ? (
              <Pressable
                onPress={() => {
                  setEditingAffiliate("");
                  setPartnerName("");
                  setPartnerEmail("");
                  setCode("");
                }}
                style={s.secondary}
              >
                <Text style={s.secondaryText}>Cancel editing</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
      <Text style={s.section}>Partners & performance</Text>
      <View style={s.list}>
        {affiliates.map((item) => {
          const data = metric(item);
          return (
            <View key={item.affiliate_id} style={s.card}>
              <View style={s.row}>
                <View style={s.copy}>
                  <Text style={s.cardTitle}>{item.display_name}</Text>
                  <Text style={s.hint}>
                    {item.code} · {item.programme_name} ·{" "}
                    {item.purchase_commission_bps / 100}%
                  </Text>
                </View>
                <Text style={s.status}>{item.status}</Text>
              </View>
              <View style={s.metrics}>
                <Text style={s.metric}>{data?.click_count ?? 0} clicks</Text>
                <Text style={s.metric}>
                  {data?.conversion_count ?? 0} sales
                </Text>
                <Text style={s.metric}>
                  {formatGHS(data?.commission_minor ?? 0)} earned
                </Text>
              </View>
              <Pressable
                onPress={() => editAffiliate(item)}
                style={s.secondary}
              >
                <Text style={s.secondaryText}>Edit affiliate</Text>
              </Pressable>
              {item.status === "active" ? (
                <Pressable
                  onPress={() =>
                    void businessAffiliatesApi
                      .pauseAffiliate(item.affiliate_id)
                      .then(load)
                  }
                  style={s.secondary}
                >
                  <Text style={s.secondaryText}>Pause affiliate</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {affiliates.length === 0 ? (
          <Text style={s.hint}>No creators have joined a programme yet.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
