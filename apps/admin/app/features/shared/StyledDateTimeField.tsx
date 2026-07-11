import { useState } from "react";
import TextField from "../../components/form-text-field";
import { splitDateTimeInputValue } from "./dates";



export function StyledDateTimeField({
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
  const initial = splitDateTimeInputValue(defaultValue);
  const [value, setValue] = useState(
    initial.date && initial.time ? `${initial.date}T${initial.time}` : "",
  );
  return (
    <TextField
      type="datetime-local"
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
