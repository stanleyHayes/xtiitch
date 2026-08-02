import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { type BusinessDesign } from "../../../../src/businessApi";
import {
  businessAdminApi,
  type PromotionBody,
} from "../../../../src/businessAdminApi";
import { LoadingButtonLabel } from "../../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

type DiscountType = "percentage" | "fixed";
type Scope = "store" | "design";

// Server-side code rule: uppercase A–Z, digits, underscore or dash, 3–32
// chars, alphanumeric first AND last (must match the server's exact regex).
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$/;

// GH₵ cedis string → minor units (pesewas); null when blank or not a
// non-negative number.
function parseMoneyMinor(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

// eslint-disable-next-line max-lines-per-function -- complete promotion creation form
export function CreatePromotionCard({
  designs,
  onCreated,
  onSessionExpired,
}: {
  designs: BusinessDesign[];
  onCreated: () => void;
  onSessionExpired: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [value, setValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [scope, setScope] = useState<Scope>("store");
  const [designId, setDesignId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setCode("");
    setTitle("");
    setDiscountType("percentage");
    setValue("");
    setMaxDiscount("");
    setMinSpend("");
    setScope("store");
    setDesignId(null);
    setError(null);
  };

  // Returns the request body, or null after setting an inline error.
  // eslint-disable-next-line complexity -- validates the complete promotion contract
  const buildBody = (): PromotionBody | null => {
    if (!CODE_RE.test(code)) {
      setError(
        "Codes start and end with a letter or number (3–32 chars, dashes/underscores inside).",
      );
      return null;
    }
    if (!title.trim()) {
      setError("Give the promotion a title.");
      return null;
    }

    let discountValue: number;
    let maxDiscountMinor: number | null = null;
    if (discountType === "percentage") {
      // Staff think in percent; the API stores basis points (10% → 1000).
      const percent = Number.parseFloat(value);
      if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
        setError("Enter a percentage between 1 and 100.");
        return null;
      }
      discountValue = Math.round(percent * 100);
      maxDiscountMinor = parseMoneyMinor(maxDiscount);
      if (maxDiscountMinor === null || maxDiscountMinor <= 0) {
        setError("Set a max discount (GH₵) — required for percentage codes.");
        return null;
      }
    } else {
      const fixedMinor = parseMoneyMinor(value);
      if (fixedMinor === null || fixedMinor <= 0) {
        setError("Enter the fixed discount in GH₵.");
        return null;
      }
      discountValue = fixedMinor;
    }

    const minSpendMinor = minSpend.trim() ? parseMoneyMinor(minSpend) : 0;
    if (minSpendMinor === null) {
      setError("Minimum spend must be a valid amount in GH₵.");
      return null;
    }
    if (scope === "design" && !designId) {
      setError("Pick the design this code applies to.");
      return null;
    }

    return {
      code,
      title: title.trim(),
      discount_type: discountType,
      discount_value: discountValue,
      max_discount_minor: maxDiscountMinor,
      min_spend_minor: minSpendMinor,
      scope,
      target_design_id: scope === "design" ? designId : null,
      status: "active",
    };
  };

  const submit = async () => {
    setError(null);
    const body = buildBody();
    if (!body) return;
    setSubmitting(true);
    const result = await businessAdminApi.createPromotion(body);
    setSubmitting(false);
    if (result.ok) {
      clear();
      onCreated();
    } else if (result.expired) {
      onSessionExpired();
    } else if (result.error === "upstream_409") {
      setError("That code is already in use.");
    } else if (result.error === "upstream_403") {
      setError("Promotions are not included in your current plan.");
    } else {
      setError("Couldn't create the promotion. Check the details and retry.");
    }
  };

  const canSubmit =
    code.trim().length > 0 && title.trim().length > 0 && !submitting;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Create promotion</Text>

      <Text style={styles.fieldLabel}>Code</Text>
      <TextInput
        value={code}
        onChangeText={(next) => setCode(next.toUpperCase())}
        placeholder="EID25"
        placeholderTextColor={palette.mutedText}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={32}
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Eid sale"
        placeholderTextColor={palette.mutedText}
        autoCorrect={false}
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>Discount type</Text>
      <View style={styles.chipRow}>
        <Chip
          label="Percentage"
          active={discountType === "percentage"}
          onPress={() => setDiscountType("percentage")}
        />
        <Chip
          label="Fixed amount"
          active={discountType === "fixed"}
          onPress={() => setDiscountType("fixed")}
        />
      </View>

      <Text style={styles.fieldLabel}>
        {discountType === "percentage" ? "Discount (%)" : "Discount (GH₵)"}
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={discountType === "percentage" ? "10" : "0.00"}
        placeholderTextColor={palette.mutedText}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      {discountType === "percentage" ? (
        <>
          <Text style={styles.fieldLabel}>Max discount (GH₵)</Text>
          <TextInput
            value={maxDiscount}
            onChangeText={setMaxDiscount}
            placeholder="0.00"
            placeholderTextColor={palette.mutedText}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <Text style={styles.hint}>
            Cap the discount so a big order does not wipe your margin.
          </Text>
        </>
      ) : null}

      <Text style={styles.fieldLabel}>Minimum spend (GH₵, optional)</Text>
      <TextInput
        value={minSpend}
        onChangeText={setMinSpend}
        placeholder="0.00"
        placeholderTextColor={palette.mutedText}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>Scope</Text>
      <View style={styles.chipRow}>
        <Chip
          label="Store-wide"
          active={scope === "store"}
          onPress={() => setScope("store")}
        />
        <Chip
          label="Design"
          active={scope === "design"}
          onPress={() => setScope("design")}
        />
      </View>

      {scope === "design" ? (
        designs.length > 0 ? (
          <View style={styles.chipRow}>
            {designs.map((design) => (
              <Chip
                key={design.design_id}
                label={design.title}
                active={design.design_id === designId}
                onPress={() => setDesignId(design.design_id)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>
            No active designs in your catalogue yet.
          </Text>
        )
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
      >
        {submitting ? (
          <LoadingButtonLabel label="Creating promotion" />
        ) : (
          <Text style={styles.ctaText}>Create promotion</Text>
        )}
      </Pressable>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
    },
    cardTitle: {
      fontFamily: fonts.display,
      fontSize: 18,
      fontWeight: "700",
      color: palette.ink,
      marginBottom: spacing(1.5),
    },
    fieldLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
      marginTop: spacing(1.5),
      marginBottom: spacing(0.75),
    },
    input: {
      backgroundColor: palette.cream,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(0.75),
      lineHeight: 17,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(1),
    },
    chip: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
      backgroundColor: palette.cream,
    },
    chipActive: {
      borderColor: palette.burgundy,
      backgroundColor: palette.wineTint,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    chipTextActive: { color: palette.burgundy },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginTop: spacing(1.5),
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.75),
      alignItems: "center",
      marginTop: spacing(2.5),
    },
    ctaDisabled: { backgroundColor: palette.mauve },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
    },
  });
