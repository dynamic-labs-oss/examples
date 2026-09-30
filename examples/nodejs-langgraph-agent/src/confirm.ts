import type readline from "node:readline";

// ─── Shared readline instance ─────────────────────────────────────────────────

let _rl: readline.Interface | null = null;

export function setReadlineForConfirm(rl: readline.Interface): void {
  _rl = rl;
}

// ─── Confirmation prompt ──────────────────────────────────────────────────────

const WIDTH = 58;

/** Prompts the user to confirm a sensitive action. Defaults to deny. */
export async function confirm(summary: string): Promise<boolean> {
  const bar = "─".repeat(WIDTH);

  process.stdout.write(`\n┌─ ACTION REQUIRED ${bar.slice(18)}\n`);
  for (const line of summary.split("\n")) {
    process.stdout.write(`│  ${line}\n`);
  }
  process.stdout.write(`└${bar}\n`);

  return new Promise((resolve) => {
    if (!_rl) {
      process.stdout.write("No readline available — action denied.\n");
      resolve(false);
      return;
    }
    _rl.question("Proceed? [y/N] ", (answer) => {
      const confirmed = answer.trim().toLowerCase() === "y";
      if (!confirmed) process.stdout.write("Cancelled.\n");
      resolve(confirmed);
    });
  });
}
