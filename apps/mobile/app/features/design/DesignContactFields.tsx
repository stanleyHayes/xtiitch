import { StyleSheet, View } from "react-native";
import { spacing } from "../../../src/theme";
import DesignField from "./DesignField";

export type ContactFields = {
  name: string;
  phone: string;
  email: string;
  whatsapp: string;
  note: string;
};

type DesignContactFieldsProps = {
  values: ContactFields;
  onChange: (field: keyof ContactFields, next: string) => void;
};

export default function DesignContactFields({
  values,
  onChange,
}: DesignContactFieldsProps) {
  return (
    <View style={styles.form}>
      <DesignField
        label="Full name"
        value={values.name}
        onChange={(next) => onChange("name", next)}
        placeholder="Ama Mensah"
      />
      <DesignField
        label="Phone"
        value={values.phone}
        onChange={(next) => onChange("phone", next)}
        placeholder="+233 50 123 4567"
        keyboardType="phone-pad"
      />
      <DesignField
        label="WhatsApp (optional)"
        value={values.whatsapp}
        onChange={(next) => onChange("whatsapp", next)}
        placeholder="+233 50 123 4567"
        keyboardType="phone-pad"
      />
      <DesignField
        label="Email"
        value={values.email}
        onChange={(next) => onChange("email", next)}
        placeholder="you@example.com"
        keyboardType="email-address"
      />
      <DesignField
        label="Note for the studio (optional)"
        value={values.note}
        onChange={(next) => onChange("note", next)}
        placeholder="Anything the studio should know"
        autoCapitalize="sentences"
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing(1.75) },
});
