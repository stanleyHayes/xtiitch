

export const ghs = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
});



export function formatGHS(minor: number): string {
  return ghs.format(minor / 100);
}



export function formatPercentBps(value: number): string {
  return `${(value / 100).toFixed(1)}%`;
}
