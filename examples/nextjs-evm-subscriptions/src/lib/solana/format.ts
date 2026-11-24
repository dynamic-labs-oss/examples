// Plan periods are stored in whole hours.
export function formatPlanPeriod(periodHours: bigint | number): string {
  const h = Number(periodHours);
  if (h === 1) return "per hour";
  if (h === 24) return "per day";
  if (h === 168) return "per week";
  if (h === 720) return "per month (30d)";
  if (h % 24 === 0) return `every ${h / 24} days`;
  return `every ${h} hours`;
}

export function formatDateTime(unixSeconds: bigint | number): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
}
