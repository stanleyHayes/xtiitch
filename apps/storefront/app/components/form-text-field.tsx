import MuiTextField, { type TextFieldProps } from "@mui/material/TextField";

const placeholderRules: [RegExp, string][] = [
  [/store.*handle|business.*handle|^handle$|slug/, "demo-atelier"],
  [/operator.*email|admin.*email/, "operator@xtiitch.com"],
  [/email/, "you@example.com"],
  [/temporary.*password|new.*password/, "At least 8 characters"],
  [/password|passcode/, "Enter your password"],
  [/business.*name|store.*name|shop.*name/, "Kente Atelier"],
  [/display.*name|customer.*name|owner.*name|full.*name|^name$/, "Ama Mensah"],
  [/phone|sms|mobile|whatsapp/, "+233 50 123 4567"],
  [/address|landmark/, "House number, street, area, landmark"],
  [/code|coupon|voucher|referral|affiliate/, "WELCOME10"],
  [/title|headline|subject/, "Summer linen kaftan"],
  [/description|note|reason|message|bio|helper/, "Add a short note"],
  [/percent|percentage|rate/, "10"],
  [/amount|price|cap|spend|value|budget|fee|commission|payout|cost|total|deposit/, "0.00"],
  [/quantity|stock|limit|uses|count|sequence|slot|days|minutes|duration/, "0"],
  [/url|website|link|callback|webhook/, "https://example.com"],
  [/color|colour/, "Ivory"],
  [/size|measurement|length|width|height|chest|waist|hip|sleeve/, "42"],
  [/search|lookup|find/, "Search by name, code, email..."],
  [/timezone/, "Africa/Accra"],
];

function labelText(label: TextFieldProps["label"]): string {
  return typeof label === "string" ? label : "";
}

function placeholderForField(props: TextFieldProps): string | undefined {
  if (props.select || props.type === "date" || props.type === "time") {
    return undefined;
  }

  const key = `${String(props.name ?? "")} ${labelText(props.label)}`.toLowerCase();
  const match = placeholderRules.find(([pattern]) => pattern.test(key));
  if (match) {
    return match[1];
  }
  if (props.type === "email") {
    return "you@example.com";
  }
  if (props.type === "password") {
    return "Enter your password";
  }
  if (props.type === "number") {
    return "0";
  }
  if (props.multiline) {
    return "Add details here";
  }

  const label = labelText(props.label);
  return label ? `Enter ${label.toLowerCase()}` : undefined;
}

function visiblePlaceholderSlotProps(
  slotProps: TextFieldProps["slotProps"],
): TextFieldProps["slotProps"] {
  const inputLabel =
    typeof slotProps?.inputLabel === "object" && slotProps.inputLabel !== null
      ? slotProps.inputLabel
      : {};

  return {
    ...slotProps,
    inputLabel: {
      ...inputLabel,
      shrink: true,
    },
  };
}

export default function TextField(props: TextFieldProps) {
  const placeholder = props.placeholder ?? placeholderForField(props);
  const slotProps = placeholder
    ? visiblePlaceholderSlotProps(props.slotProps)
    : props.slotProps;

  return <MuiTextField {...props} placeholder={placeholder} slotProps={slotProps} />;
}
