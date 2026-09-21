/**
 * This settles real USDC on Base mainnet (see WithdrawalForm.tsx's original
 * comment, now shared by DepositForm.tsx and WithdrawForm.tsx) — there's no
 * testnet fallback, so a demo-appropriate cap is the only thing standing
 * between a typo (e.g. "100" instead of "1.00") and an expensive mistake.
 * Shared by both directions rather than given each its own limit: the same
 * USDC/Base rail carries both, so there's no reason for one direction to be
 * riskier than the other. Raise this if you actually need to test a larger
 * amount.
 */
export const MAX_AMOUNT_USD = 5;
