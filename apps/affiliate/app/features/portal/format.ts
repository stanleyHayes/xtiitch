const money = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS"
});

const date = new Intl.DateTimeFormat("en-GH", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

export function formatMoney(minor: number) {
  return money.format(minor / 100);
}

export function formatDate(value: string) {
  return date.format(new Date(value));
}

export function formatRateBps(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}
