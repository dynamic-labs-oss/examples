// Shared by the API routes and the UI (no server-only imports).

/**
 * Frequencies a user can pick for a rule. The cron endpoint ticks on a fixed
 * schedule (see vercel.json, hourly) and each rule only runs once its own
 * interval has elapsed, so the smallest option should not be below the tick.
 */
export const FREQUENCIES = {
  hourly: { label: "Hourly", minutes: 60 },
  "6h": { label: "Every 6 hours", minutes: 6 * 60 },
  daily: { label: "Daily", minutes: 24 * 60 },
  weekly: { label: "Weekly", minutes: 7 * 24 * 60 },
} as const;

export type Frequency = keyof typeof FREQUENCIES;

export const FREQUENCY_KEYS = Object.keys(FREQUENCIES) as [
  Frequency,
  ...Frequency[],
];

export const DEFAULT_FREQUENCY: Frequency = "daily";

/** Cron ticks drift a little; don't make a rule wait a whole extra tick for it. */
const TOLERANCE_MS = 60_000;

type Schedulable = { frequency?: Frequency; lastRunAt?: string };

export function frequencyOf(rule: Pick<Schedulable, "frequency">): Frequency {
  return rule.frequency && rule.frequency in FREQUENCIES
    ? rule.frequency
    : DEFAULT_FREQUENCY;
}

/** A rule that has never run is due immediately; otherwise once its interval elapsed. */
export function isDue(rule: Schedulable, now = Date.now()): boolean {
  if (!rule.lastRunAt) return true;
  const intervalMs = FREQUENCIES[frequencyOf(rule)].minutes * 60_000;
  return now - Date.parse(rule.lastRunAt) >= intervalMs - TOLERANCE_MS;
}
