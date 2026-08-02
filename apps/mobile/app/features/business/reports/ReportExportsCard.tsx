import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import {
  exportReport,
  type ReportFormat,
  type ReportKind,
} from "../../../../src/reportExports";
import { useTheme } from "../../../../src/theme-mode";
import { makeStyles } from "../../../business/reports.styles";

const REPORTS: { value: ReportKind; label: string }[] = [
  { value: "financial", label: "Financial" },
  { value: "sales", label: "Sales" },
  { value: "full", label: "Full suite" },
];
const FORMATS: ReportFormat[] = ["csv", "pdf", "docx", "xlsx"];

export function ReportExportsCard() {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const [report, setReport] = useState<ReportKind>("financial");
  const [busy, setBusy] = useState("");
  const download = async (format: ReportFormat) => {
    setBusy(format);
    const result = await exportReport(report, format);
    setBusy("");
    if (!result.ok) Alert.alert("Export unavailable", result.message);
  };
  return (
    <View style={s.scheduleCard}>
      <View>
        <Text style={s.rowTitle}>Download a report</Text>
        <Text style={s.rowHint}>
          Your plan decides which reports and file formats are available.
        </Text>
      </View>
      <View style={s.scheduleOptions}>
        {REPORTS.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setReport(item.value)}
            style={[
              s.scheduleChip,
              report === item.value && s.scheduleChipActive,
            ]}
          >
            <Text
              style={[
                s.scheduleChipText,
                report === item.value && s.scheduleChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.scheduleOptions}>
        {FORMATS.map((format) => (
          <Pressable
            key={format}
            disabled={Boolean(busy)}
            onPress={() => void download(format)}
            style={s.scheduleChip}
          >
            <Text style={s.scheduleChipText}>
              {busy === format ? "Preparing…" : format.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
