import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatGHS } from "../../../../src/api";
import { formatOrderDate } from "../../../../src/businessApi";
import {
  paymentPurposeLabel,
  type ManualTaking,
  type MoneyPayout,
  type MoneyTransaction,
} from "../../../../src/businessOpsApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

function methodLabel(method: string): string {
  if (method === "momo") return "Mobile money";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Section({
  label,
  empty,
  children,
}: {
  label: string;
  empty?: { title: string; hint: string };
  children?: ReactNode;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children ? (
        <View style={styles.listCard}>{children}</View>
      ) : empty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{empty.title}</Text>
          <Text style={styles.emptyHint}>{empty.hint}</Text>
        </View>
      ) : null}
    </>
  );
}

function Row({
  title,
  subtitle,
  amount,
  note,
  isLast,
}: {
  title: string;
  subtitle: string;
  amount: string;
  note?: string;
  isLast: boolean;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.rowSide}>
        <Text style={styles.rowAmount}>{amount}</Text>
        {note ? <Text style={styles.rowNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

export function TransactionsList({
  transactions,
}: {
  transactions: MoneyTransaction[];
}) {
  return (
    <Section
      label="Transactions"
      empty={
        transactions.length === 0
          ? {
              title: "No transactions",
              hint: "Payments through checkout will appear here.",
            }
          : undefined
      }
    >
      {transactions.length > 0
        ? transactions.map((transaction, index) => (
            <Row
              key={transaction.payment_id}
              title={transaction.design_title || "Payment"}
              subtitle={[
                transaction.customer_name,
                paymentPurposeLabel(transaction.purpose),
                methodLabel(transaction.method),
                formatOrderDate(transaction.created_at),
              ]
                .filter(Boolean)
                .join(" · ")}
              amount={formatGHS(transaction.amount_minor)}
              isLast={index === transactions.length - 1}
            />
          ))
        : null}
    </Section>
  );
}

export function TakingsList({ takings }: { takings: ManualTaking[] }) {
  return (
    <Section
      label="Takings"
      empty={
        takings.length === 0
          ? {
              title: "No manual takings",
              hint: "Cash and off-platform income you log will appear here.",
            }
          : undefined
      }
    >
      {takings.length > 0
        ? takings.map((taking, index) => (
            <Row
              key={taking.taking_id}
              title={taking.what_for}
              subtitle={`${methodLabel(taking.method)} · ${formatOrderDate(taking.taken_at)}`}
              amount={formatGHS(taking.amount_minor)}
              isLast={index === takings.length - 1}
            />
          ))
        : null}
    </Section>
  );
}

export function PayoutsList({ payouts }: { payouts: MoneyPayout[] }) {
  return (
    <Section
      label="Payouts"
      empty={
        payouts.length === 0
          ? {
              title: "No payouts",
              hint: "Settlements to your account will appear here.",
            }
          : undefined
      }
    >
      {payouts.length > 0
        ? payouts.map((payout, index) => (
            <Row
              key={payout.settlement_id}
              title={payout.reference}
              subtitle={`${capitalize(payout.status)} · ${formatOrderDate(payout.created_at)}`}
              amount={formatGHS(payout.amount_minor)}
              // settled_at is an empty string (not null) until the payout settles.
              note={
                payout.settled_at
                  ? `Settled ${formatOrderDate(payout.settled_at)}`
                  : "Pending"
              }
              isLast={index === payouts.length - 1}
            />
          ))
        : null}
    </Section>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    sectionLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: palette.mutedText,
      marginTop: spacing(3),
      marginBottom: spacing(1.5),
    },
    listCard: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      gap: spacing(1.5),
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: palette.softBorder },
    rowMain: { flex: 1, minWidth: 0 },
    rowTitle: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
    },
    rowSubtitle: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(0.25),
    },
    rowSide: { alignItems: "flex-end" },
    rowAmount: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
    },
    rowNote: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(0.25),
    },
    empty: {
      backgroundColor: palette.panel,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(3),
      alignItems: "center",
    },
    emptyTitle: {
      fontFamily: fonts.display,
      fontSize: 18,
      color: palette.ink,
    },
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      textAlign: "center",
      marginTop: spacing(0.75),
      lineHeight: 20,
    },
  });
