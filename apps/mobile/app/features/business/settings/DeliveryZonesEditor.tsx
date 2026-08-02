import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import {
  businessCatalogueApi,
  type DeliveryZoneSetting,
} from "../../../../src/businessCatalogueApi";
import { formatGHS } from "../../../../src/api";
import { useTheme } from "../../../../src/theme-mode";
import { makeStyles } from "../../../business/store-settings.styles";

export function DeliveryZonesEditor() {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const [items, setItems] = useState<DeliveryZoneSetting[]>([]);
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [editingId, setEditingId] = useState("");
  const load = async () => {
    const result = await businessCatalogueApi.deliveryZones();
    if (result.ok) setItems(result.data.zones);
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    const current = items.find((item) => item.zone_id === editingId);
    const input = {
      name: name.trim(),
      fee_minor: Math.round(Number(fee) * 100),
      sequence: current?.sequence ?? items.length,
      active: current?.active ?? true,
    };
    const result = editingId
      ? await businessCatalogueApi.updateDeliveryZone(editingId, input)
      : await businessCatalogueApi.createDeliveryZone(input);
    if (result.ok) {
      setName("");
      setFee("");
      setEditingId("");
      await load();
    } else Alert.alert("Couldn’t save delivery zone");
  };
  const edit = (item: DeliveryZoneSetting) => {
    setEditingId(item.zone_id);
    setName(item.name);
    setFee((item.fee_minor / 100).toFixed(2));
  };
  const toggle = async (item: DeliveryZoneSetting, active: boolean) => {
    const result = await businessCatalogueApi.updateDeliveryZone(item.zone_id, {
      name: item.name,
      fee_minor: item.fee_minor,
      sequence: item.sequence,
      active,
    });
    if (result.ok)
      setItems(
        items.map((entry) =>
          entry.zone_id === item.zone_id ? { ...entry, active } : entry,
        ),
      );
  };
  const remove = (item: DeliveryZoneSetting) =>
    Alert.alert("Remove delivery zone?", item.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const result = await businessCatalogueApi.deleteDeliveryZone(
            item.zone_id,
          );
          if (result.ok)
            setItems(items.filter((entry) => entry.zone_id !== item.zone_id));
        },
      },
    ]);
  return (
    <>
      <Text style={s.sectionTitle}>Delivery zones</Text>
      <Text style={s.sectionHint}>
        Set the areas customers can choose and the exact checkout fee.
      </Text>
      <View style={s.brandPanel}>
        {items.map((item) => (
          <View key={item.zone_id} style={s.zoneRow}>
            <View style={s.copy}>
              <Text style={s.label}>{item.name}</Text>
              <Text style={s.hint}>
                {formatGHS(item.fee_minor)} ·{" "}
                {item.active ? "Available" : "Hidden"}
              </Text>
            </View>
            <Switch
              value={item.active}
              onValueChange={(active) => void toggle(item, active)}
              trackColor={{ true: palette.burgundy }}
            />
            <Pressable onPress={() => edit(item)} style={s.zoneRemove}>
              <Text style={s.zoneRemoveText}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => remove(item)} style={s.zoneRemove}>
              <Text style={s.zoneRemoveText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <View style={s.zoneCreate}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Area, e.g. Accra Central"
            placeholderTextColor={palette.mutedText}
            style={[s.brandInput, s.zoneName]}
          />
          <TextInput
            value={fee}
            onChangeText={setFee}
            placeholder="Fee GHS"
            placeholderTextColor={palette.mutedText}
            keyboardType="decimal-pad"
            style={[s.brandInput, s.zoneFee]}
          />
          <Pressable
            disabled={!name.trim() || !fee}
            onPress={() => void save()}
            style={s.brandSave}
          >
            <Text style={s.brandSaveText}>{editingId ? "Save" : "Add"}</Text>
          </Pressable>
          {editingId ? (
            <Pressable
              onPress={() => {
                setEditingId("");
                setName("");
                setFee("");
              }}
              style={s.zoneRemove}
            >
              <Text style={s.zoneRemoveText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </>
  );
}
