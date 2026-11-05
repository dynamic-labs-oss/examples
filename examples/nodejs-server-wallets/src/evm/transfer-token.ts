#!/usr/bin/env tsx

/**
 * Dynamic ERC-20 Transfer Demo
 *
 * Move an ERC-20 token from a server wallet, with or without gas sponsorship.
 *
 * ## Usage
 *
 *   pnpm evm:transfer-token                                  # 0 USDC to self, wallet pays gas
 *   pnpm evm:transfer-token --to 0xRecipient --amount 1.5
 *   pnpm evm:transfer-token --token 0xToken --amount 10
 *   pnpm evm:transfer-token --sponsored                      # Dynamic pays gas
 *   pnpm evm:transfer-token --address 0x123... --password xyz
 *
 * Defaults to a 0-amount self-transfer of the example USDC, so it runs with no
 * arguments and without funding anything. A self-transfer is always a valid
 * recipient, and 0 is always an affordable amount.
 *
 * ## How a token transfer differs from a native send
 *
 * Native value moves in the transaction's own `value` field. A token balance is a
 * number in the token contract's storage, so moving it means *calling* the
 * contract: `to` is the token, `value` is 0, and the recipient and amount live in
 * the calldata. `src/evm/send-transaction.ts` is the native counterpart.
 *
 * Decimals come from the contract, because "1.5 tokens" is meaningless without
 * them — see `src/lib/token/evm.ts`.
 *
 * ## Gas
 *
 * Default is **standard**: the wallet pays, so it needs a native balance.
 * `--sponsored` routes the same call through Dynamic's sponsorship instead, and
 * the wallet needs no balance at all. For a *retry-safe* token transfer, use
 * `pnpm example:transfer --token ...`, which adds idempotency on top.
 */

import { encodeFunctionData, erc20Abi, formatEther, type Hex } from "viem";

import { CONTRACTS, DEFAULT_CHAIN, evmRpcUrl } from "../../constants";
import { parseArgs, runScript } from "../lib/cli";
import { authenticatedEvmClient, type EvmClient } from "../lib/clients/evm";
import { sendSponsoredTransaction } from "../lib/gasless/evm";
import {
  assertDecimalAmount,
  fromBaseUnits,
  toBaseUnits,
} from "../lib/token/amount";
import { readEvmTokenDecimals } from "../lib/token/evm";
import { getTransactionLink } from "../lib/utils";
import { getOrCreateWallet, type WalletInfo } from "../lib/wallet-helpers";

const DEFAULT_TOKEN = CONTRACTS[DEFAULT_CHAIN.id].USDC;

/**
 * Build the `transfer(address,uint256)` calldata.
 *
 * viem's `erc20Abi` is used rather than the hand-written `TOKEN_ABI` in
 * constants.ts, which exists only for the example token's non-standard `mint`.
 */
function transferCalldata(to: Hex, amountBaseUnits: bigint): Hex {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amountBaseUnits],
  });
}

/**
 * Step 3a: Send the transfer with the wallet paying its own gas.
 */
async function transferStandard(
  evmClient: EvmClient,
  wallet: WalletInfo,
  token: Hex,
  data: Hex,
  password?: string,
) {
  const walletClient = await evmClient.getWalletClient({
    walletMetadata: wallet.walletMetadata,
    ...(wallet.externalServerKeyShares.length > 0 && {
      externalServerKeyShares: wallet.externalServerKeyShares,
    }),
    chain: DEFAULT_CHAIN,
    rpcUrl: evmRpcUrl(),
    password,
  });

  console.info(`Sending ERC-20 transfer (wallet pays gas)...`);

  // `to` is the token contract and `value` is 0 — the transfer is entirely in the
  // calldata. Nonce, gas, and broadcast are the wallet client's job.
  return walletClient.sendTransaction({ to: token, value: 0n, data });
}

/**
 * Step 3b: Send the same transfer with Dynamic sponsoring the gas.
 *
 * A sponsored transaction is a batch of calls, so the ERC-20 call becomes one
 * entry. Nothing about the transfer itself changes — only who pays.
 */
async function transferSponsored(
  evmClient: EvmClient,
  wallet: WalletInfo,
  token: Hex,
  data: Hex,
  password?: string,
) {
  console.info(`Sending ERC-20 transfer (sponsored by Dynamic)...`);

  const { transactionHash } = await sendSponsoredTransaction({
    evmClient,
    walletMetadata: wallet.walletMetadata,
    externalServerKeyShares: wallet.externalServerKeyShares,
    password,
    calls: [{ target: token, data, value: 0n }],
  });

  return transactionHash;
}

/**
 * A wallet with no ETH cannot pay gas, and the resulting RPC error names neither
 * the wallet nor the sponsored alternative. Check first and say both.
 */
async function assertCanPayGas(
  publicClient: ReturnType<EvmClient["createViemPublicClient"]>,
  wallet: WalletInfo,
) {
  const balance = await publicClient.getBalance({
    address: wallet.address as Hex,
  });

  if (balance === 0n) {
    console.error(`Wallet has no ${DEFAULT_CHAIN.nativeCurrency.symbol} and cannot pay gas.`);
    console.error(`Address: ${wallet.address}`);
    console.error(`\nFund it, or use --sponsored which needs no balance:`);
    console.error(`  pnpm evm:transfer-token --sponsored --address ${wallet.address}`);
    process.exit(1);
  }

  console.info(`Gas balance: ${formatEther(balance)} ${DEFAULT_CHAIN.nativeCurrency.symbol}`);
}

runScript(async () => {
  const { getFlag, hasFlag } = parseArgs(process.argv);

  const token = (getFlag("token") ?? DEFAULT_TOKEN) as Hex;
  const amount = getFlag("amount") ?? "0";
  const address = getFlag("address");
  const password = getFlag("password");
  const sponsored = hasFlag("sponsored");

  // Reject a malformed amount before creating a client or a wallet — the scale
  // needs the token's decimals, but the format doesn't.
  assertDecimalAmount(amount);

  // Step 1: Get or create the wallet
  const evmClient = await authenticatedEvmClient();
  const wallet = await getOrCreateWallet(evmClient, address, password);

  // A self-transfer is always a valid recipient, so it makes a safe default.
  const recipient = (getFlag("to") ?? wallet.address) as Hex;

  // Step 2: Read decimals from the contract, then scale the amount
  console.info(`\nReading decimals for token ${token}...`);
  const publicClient = evmClient.createViemPublicClient({
    chain: DEFAULT_CHAIN,
    rpcUrl: evmRpcUrl(),
  });
  const decimals = await readEvmTokenDecimals(publicClient, token);
  const amountBaseUnits = toBaseUnits(amount, decimals);

  console.info(`Decimals: ${decimals}`);
  console.info(
    `Amount: ${fromBaseUnits(amountBaseUnits, decimals)} (${amountBaseUnits} base units)`,
  );
  console.info(`Recipient: ${recipient}`);

  if (!sponsored) await assertCanPayGas(publicClient, wallet);

  const data = transferCalldata(recipient, amountBaseUnits);
  const start = Date.now();

  // Step 3: Send, paying gas either from the wallet or from Dynamic
  const hash = sponsored
    ? await transferSponsored(evmClient, wallet, token, data, password)
    : await transferStandard(evmClient, wallet, token, data, password);

  // Step 4: Display results
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.info(`\nTransfer sent in ${duration}s`);
  console.info(`Hash: ${hash}`);
  console.info(`Explorer: ${getTransactionLink(hash)}`);
  console.info(`Token: ${token}`);
  console.info(`From: ${wallet.address}`);
  console.info(`To: ${recipient}`);
  console.info(`Gas paid by: ${sponsored ? "Dynamic sponsor" : "the wallet"}`);
});
