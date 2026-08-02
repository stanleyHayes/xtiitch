import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import {
  businessAnalyticsApi,
  type ReportSchedule,
} from "../../../../src/businessAnalyticsApi";
import { useTheme } from "../../../../src/theme-mode";
import { makeStyles } from "../../../business/reports.styles";

const initial: ReportSchedule = {
  report: "sales",
  format: "csv",
  cadence: "monthly",
  email: "",
  enabled: true,
  last_sent_at: null,
};

export function ReportScheduleCard() {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const [schedule, setSchedule] = useState(initial);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    businessAnalyticsApi.reportSchedule().then((result) => {
      if (result.ok) {
        setSchedule(result.data.schedule);
        setAvailable(true);
      } else setAvailable(result.error === "upstream_404");
    });
  }, []);
  if (available === false)
    return (
      <View style={s.upgrade}>
        <Text style={s.upgradeTitle}>Scheduled reports</Text>
        <Text style={s.upgradeHint}>
          Automated email reports unlock on Growth and Studio.
        </Text>
      </View>
    );
  const save = async () => {
    setBusy(true);
    const result = await businessAnalyticsApi.saveReportSchedule(schedule);
    setBusy(false);
    if (result.ok) {
      setSchedule(result.data.schedule);
      setAvailable(true);
      Alert.alert("Report schedule saved");
    } else
      Alert.alert(
        "Couldn’t save schedule",
        "Check the email and your plan allowance.",
      );
  };
  return (
    <View style={s.scheduleCard}>
      <View style={s.scheduleHead}>
        <View>
          <Text style={s.upgradeTitle}>Scheduled reports</Text>
          <Text style={s.upgradeHint}>
            Email the studio’s numbers automatically.
          </Text>
        </View>
        <Switch
          value={schedule.enabled}
          onValueChange={(enabled) =>
            setSchedule((old) => ({ ...old, enabled }))
          }
          trackColor={{ true: palette.burgundy }}
        />
      </View>
      <TextInput
        value={schedule.email}
        onChangeText={(email) => setSchedule((old) => ({ ...old, email }))}
        placeholder="Report email"
        placeholderTextColor={palette.mutedText}
        keyboardType="email-address"
        autoCapitalize="none"
        style={s.scheduleInput}
      />
      <View style={s.scheduleOptions}>
        {["weekly", "monthly"].map((cadence) => (
          <Pressable
            key={cadence}
            onPress={() => setSchedule((old) => ({ ...old, cadence }))}
            style={[
              s.scheduleChip,
              schedule.cadence === cadence && s.scheduleChipActive,
            ]}
          >
            <Text
              style={[
                s.scheduleChipText,
                schedule.cadence === cadence && s.scheduleChipTextActive,
              ]}
            >
              {cadence}
            </Text>
          </Pressable>
        ))}
        {["csv", "pdf"].map((format) => (
          <Pressable
            key={format}
            onPress={() => setSchedule((old) => ({ ...old, format }))}
            style={[
              s.scheduleChip,
              schedule.format === format && s.scheduleChipActive,
            ]}
          >
            <Text
              style={[
                s.scheduleChipText,
                schedule.format === format && s.scheduleChipTextActive,
              ]}
            >
              {format.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        disabled={busy || !schedule.email}
        onPress={() => void save()}
        style={s.scheduleSave}
      >
        <Text style={s.scheduleSaveText}>
          {busy ? "Saving…" : "Save schedule"}
        </Text>
      </Pressable>
    </View>
  );
}
