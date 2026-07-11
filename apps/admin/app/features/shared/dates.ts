

export function shortTime(value: string): string {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}



export function shortTimeOrFallback(value?: string, fallback = "Not set"): string {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return shortTime(value);
}



export function shortID(value: string): string {
  return value.slice(0, 8);
}



export function datetimeLocalDefault(value?: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
}



export function splitDateTimeInputValue(value = ""): {
  date: string;
  time: string;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) {
    const fallback = datetimeLocalDefault(value);
    return fallback && fallback !== value
      ? splitDateTimeInputValue(fallback)
      : { date: "", time: "" };
  }
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`,
  };
}



export function normaliseTimeInput(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}



export function splitTimeParts(value: string): {
  hour: string;
  minute: string;
  period: "AM" | "PM" | "";
} {
  const normalised = normaliseTimeInput(value);
  if (!normalised) {
    return { hour: "", minute: "", period: "" };
  }
  const [hourRaw = "0", minute = ""] = normalised.split(":");
  const hours = Number.parseInt(hourRaw, 10);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return {
    hour: String(displayHour).padStart(2, "0"),
    minute,
    period,
  };
}



export function composeTimeInputValue(
  hour: string,
  minute: string,
  period: string,
): string {
  if (!hour || !minute || !period) {
    return "";
  }
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);
  if (
    parsedHour < 1 ||
    parsedHour > 12 ||
    parsedMinute < 0 ||
    parsedMinute > 59
  ) {
    return "";
  }
  const hours24 = period === "PM" ? (parsedHour % 12) + 12 : parsedHour % 12;
  return (
    normaliseTimeInput(
      `${String(hours24).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`,
    ) ?? ""
  );
}
