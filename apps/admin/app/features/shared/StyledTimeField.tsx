import { useState } from "react";
import TextField from "../../components/form-text-field";
import { composeTimeInputValue, splitTimeParts } from "./dates";



export function StyledTimeField({
  name,
  label,
  defaultValue = "",
  required = false,
  disabled = false,
  size = "small",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
}) {
  const initial = splitTimeParts(defaultValue);
  const [value, setValue] = useState(
    composeTimeInputValue(initial.hour, initial.minute, initial.period),
  );
  return (
    <TextField
      type="time"
      name={name}
      label={label}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      required={required}
      disabled={disabled}
      size={size}
      fullWidth
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
}
