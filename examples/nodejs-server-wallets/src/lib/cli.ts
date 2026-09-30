/**
 * CLI Utilities
 *
 * Shared helpers for command-line scripts to reduce boilerplate
 * and standardize argument parsing across all demos.
 */

/**
 * Wrapper to eliminate duplicated main() boilerplate.
 * Handles try/catch and process.exit() consistently.
 *
 * @example
 * runScript(async () => {
 *   // Your script logic here
 *   console.info("Done!");
 * });
 */
export async function runScript(fn: () => Promise<void>): Promise<never> {
  try {
    await fn();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

/**
 * Standardized argument parsing for CLI scripts.
 *
 * @example
 * const { positional, getFlag, hasFlag } = parseArgs(process.argv);
 *
 * // Get positional args (non-flag arguments)
 * const command = positional[0]; // e.g., "gasless" from "pnpm evm:send-txn gasless"
 *
 * // Get flag values
 * const address = getFlag("address"); // e.g., "0x123..." from "--address 0x123..."
 *
 * // Check boolean flags
 * const shouldSave = hasFlag("save"); // true if "--save" is present
 */
export function parseArgs(argv: string[]) {
  const args = argv.slice(2);

  return {
    /** Non-flag arguments in order */
    positional: args.filter((a) => !a.startsWith("--")),

    /**
     * Get the value following a --flag.
     *
     * Returns undefined when the flag is absent *or* its value was omitted, so
     * `--order-id --force` yields no order id rather than the literal "--force".
     * Swallowing the next flag as a value produces confusing downstream failures
     * (a garbage idempotency key, or `NaN` from a numeric flag).
     */
    getFlag: (name: string): string | undefined => {
      const idx = args.indexOf(`--${name}`);
      if (idx === -1) return undefined;

      const value = args[idx + 1];
      return value === undefined || value.startsWith("--") ? undefined : value;
    },

    /** Check if a --flag is present */
    hasFlag: (name: string): boolean => args.includes(`--${name}`),
  };
}
