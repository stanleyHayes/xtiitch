import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatGHS } from "../../../src/api";
import {
  checkoutSupport,
  type CheckoutQuote,
  type CheckoutQuoteLine,
} from "../../../src/checkoutSupport";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

// A null request hides the card (inputs incomplete); a failed quote also hides
// it — pricing must never block ordering, so there is no error state.
export type QuoteRequest = {
  items: CheckoutQuoteLine[];
  delivery_zone_id?: string;
} | null;

type DesignQuoteCardProps = {
  storeHandle: string;
  request: QuoteRequest;
};

// Server-priced breakdown shown before placement (items, delivery, fees, tax,
// total). Refetches whenever the request changes; keeps the last good quote on
// screen while a refresh is in flight.
export default function DesignQuoteCard({
  storeHandle,
  request,
}: DesignQuoteCardProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [loading, setLoading] = useState(false);
  // The request object is rebuilt each render, so the effect keys on its
  // serialised form instead of identity.
  const requestKey = JSON.stringify(request);

  useEffect(() => {
    if (!request) {
      setQuote(null);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    checkoutSupport.quote(storeHandle, request).then((result) => {
      if (stale) return;
      setLoading(false);
      setQuote(result.ok ? result.data : null);
    });
    return () => {
      stale = true;
    };
  }, [storeHandle, requestKey]);

  if (!request) return null;
  if (!quote) {
    if (!loading) return null;
    return <Text style={styles.checking}>Checking the total…</Text>;
  }

  return (
    <View style={styles.card}>
      <QuoteRow
        styles={styles}
        label="Items"
        value={formatGHS(quote.items_total_minor)}
      />
      {quote.delivery_fee_minor > 0 ? (
        <QuoteRow
          styles={styles}
          label="Delivery"
          value={formatGHS(quote.delivery_fee_minor)}
        />
      ) : null}
      <QuoteRow
        styles={styles}
        label="Transaction fee"
        value={formatGHS(quote.transaction_fee_minor)}
      />
      {quote.tax_passed_down ? (
        <QuoteRow
          styles={styles}
          label="Tax"
          value={formatGHS(quote.tax_minor)}
        />
      ) : null}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatGHS(quote.total_minor)}</Text>
      </View>
      {loading ? <Text style={styles.checking}>Updating…</Text> : null}
    </View>
  );
}

function QuoteRow({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    checking: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(1.5),
    },
    card: {
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.75),
      marginTop: spacing(2),
      gap: spacing(1),
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    rowLabel: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
    },
    rowValue: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: palette.softBorder,
      paddingTop: spacing(1),
    },
    totalLabel: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
    },
    totalValue: {
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
      color: palette.burgundy,
    },
  });
