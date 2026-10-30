import "server-only";
import {
  createDelegatedEvmWalletClient,
  delegatedSendSponsoredTransaction,
  delegatedSignTransaction,
  type DelegatedEvmWalletClient,
} from "@dynamic-labs-wallet/node-evm";
import {
  withDelegatedServerAuth,
  type ServerKeyShare,
} from "@dynamic-labs-wallet/node";
import type { EarnSigningPayload } from "@dynamic-labs-wallet/node";
import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  formatUnits,
  http,
  type Hex,
  type TransactionSerializable,
} from "viem";
import { env } from "@/env";
import { decryptSecret } from "@/lib/crypto";
import { getStore, type AutomationRule } from "@/lib/store";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const NATIVE_ASSET = "0x0000000000000000000000000000000000000000";

export function rpcUrlFor(chainId: number): string {
  const specific = process.env[`RPC_URL_${chainId}`];
  if (specific) return specific;
  if (env.RPC_URL_DEFAULT) return env.RPC_URL_DEFAULT;
  if (chainId === 8453) return "https://mainnet.base.org";
  if (chainId === 11155111) return "https://ethereum-sepolia-rpc.publicnode.com";
  throw new Error(`No RPC URL configured for chain ${chainId} (set RPC_URL_${chainId})`);
}

export function publicClientFor(chainId: number, rpcUrl: string) {
  return createPublicClient({
    chain: defineChain({
      id: chainId,
      name: `Chain ${chainId}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    }),
    transport: http(rpcUrl),
  });
}

/** Raw balance of the rule's asset on its chain. */
export async function getAssetBalance(
  rule: AutomationRule,
  rpcUrl: string
): Promise<bigint> {
  const client = publicClientFor(rule.chainId, rpcUrl);
  if (rule.assetAddress.toLowerCase() === NATIVE_ASSET) {
    return client.getBalance({ address: rule.walletAddress as Hex });
  }
  return client.readContract({
    address: rule.assetAddress as Hex,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [rule.walletAddress as Hex],
  });
}

/**
 * Resolves how much a run should deposit. `sweep` = full asset balance
 * (native sweeps keep `gasReserve` behind); `fixed` = configured amount.
 * Returns a human-readable string (the deposit quote's convention), or
 * undefined when there is nothing worth depositing.
 */
export async function resolveDepositAmount(
  rule: AutomationRule,
  rpcUrl: string
): Promise<{ amount?: string; skipReason?: string }> {
  if (rule.mode === "fixed") {
    return { amount: rule.amount };
  }
  const raw = await getAssetBalance(rule, rpcUrl);
  if (raw <= 0n) return { skipReason: "zero balance" };

  if (rule.assetAddress.toLowerCase() === NATIVE_ASSET) {
    const reserveRaw = BigInt(
      Math.round(parseFloat(rule.gasReserve) * 10 ** rule.assetDecimals)
    );
    if (raw <= reserveRaw) {
      return { skipReason: `balance ${formatUnits(raw, rule.assetDecimals)} ≤ gas reserve ${rule.gasReserve}` };
    }
    return { amount: formatUnits(raw - reserveRaw, rule.assetDecimals) };
  }
  return { amount: formatUnits(raw, rule.assetDecimals) };
}

type DelegatedWallet = {
  keyShare: ServerKeyShare;
  shareSetId?: string;
  userId: string;
  walletAddress: Hex;
  walletApiKey: string;
  walletId: string;
};

async function loadDelegatedWallet(rule: AutomationRule): Promise<DelegatedWallet> {
  const store = getStore();
  const delegation = await store.getDelegation(rule.walletAddress);
  if (!delegation) {
    throw new Error(
      `No delegation grant for ${rule.walletAddress} — user must delegate first`
    );
  }
  return {
    keyShare: JSON.parse(decryptSecret(delegation.delegatedShareEnc)),
    shareSetId: delegation.shareSetId,
    userId: delegation.userId,
    walletAddress: rule.walletAddress as Hex,
    walletApiKey: decryptSecret(delegation.walletApiKeyEnc),
    walletId: delegation.walletId,
  };
}

export function delegatedClient(): DelegatedEvmWalletClient {
  return createDelegatedEvmWalletClient({
    environmentId: env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
    apiKey: env.DYNAMIC_API_TOKEN,
  });
}

async function executeSponsored(
  client: DelegatedEvmWalletClient,
  wallet: DelegatedWallet,
  payload: EarnSigningPayload,
  rpcUrl: string
) {
  const calls: { target: Hex; data: Hex; value: bigint }[] = [];
  const approval = payload.evmApproval;
  if (approval) {
    const pub = publicClientFor(Number(payload.chainId), rpcUrl);
    const allowance = await pub.readContract({
      address: approval.tokenAddress as Hex,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [wallet.walletAddress, approval.spenderAddress as Hex],
    });
    if (allowance < BigInt(approval.amount)) {
      calls.push({
        target: approval.tokenAddress as Hex,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [approval.spenderAddress as Hex, BigInt(approval.amount)],
        }),
        value: 0n,
      });
    }
  }
  const tx = payload.evmTransaction;
  if (!tx) throw new Error("deposit quote returned no evmTransaction");
  calls.push({
    target: tx.to as Hex,
    data: tx.data as Hex,
    value: tx.value ? BigInt(tx.value) : 0n,
  });

  const { transactionHash } = await delegatedSendSponsoredTransaction(client, {
    ...wallet,
    calls,
    chainId: Number(payload.chainId),
    rpcUrl,
    autoDelegate: true,
  });
  return transactionHash;
}

async function signAndSend(
  client: DelegatedEvmWalletClient,
  wallet: DelegatedWallet,
  tx: {
    to: string;
    data: string;
    value?: string;
    gasLimit?: string;
    nonce?: number;
  },
  chainId: number,
  rpcUrl: string
): Promise<Hex> {
  const pub = publicClientFor(chainId, rpcUrl);
  const value = tx.value ? BigInt(tx.value) : 0n;
  const gas =
    tx.gasLimit !== undefined
      ? BigInt(tx.gasLimit)
      : await pub.estimateGas({
          account: wallet.walletAddress,
          to: tx.to as Hex,
          data: tx.data as Hex,
          value,
        });
  const nonce =
    tx.nonce ??
    (await pub.getTransactionCount({
      address: wallet.walletAddress,
      blockTag: "pending",
    }));
  const { maxFeePerGas, maxPriorityFeePerGas } = await pub.estimateFeesPerGas();

  const transaction: TransactionSerializable = {
    type: "eip1559",
    chainId,
    to: tx.to as Hex,
    data: tx.data as Hex,
    value,
    nonce,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
  const signed = await delegatedSignTransaction(client, {
    walletId: wallet.walletId,
    shareSetId: wallet.shareSetId,
    walletApiKey: wallet.walletApiKey,
    keyShare: wallet.keyShare,
    transaction,
  });
  const hash = await pub.sendRawTransaction({ serializedTransaction: signed as Hex });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`transaction ${hash} reverted`);
  }
  return hash;
}

async function executeUnsponsored(
  client: DelegatedEvmWalletClient,
  wallet: DelegatedWallet,
  payload: EarnSigningPayload,
  rpcUrl: string
): Promise<Hex> {
  const chainId = Number(payload.chainId);
  const pub = publicClientFor(chainId, rpcUrl);
  const approval = payload.evmApproval;
  if (approval) {
    const allowance = await pub.readContract({
      address: approval.tokenAddress as Hex,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [wallet.walletAddress, approval.spenderAddress as Hex],
    });
    if (allowance < BigInt(approval.amount)) {
      await signAndSend(
        client,
        wallet,
        {
          to: approval.tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [approval.spenderAddress as Hex, BigInt(approval.amount)],
          }),
        },
        chainId,
        rpcUrl
      );
    }
  }
  const tx = payload.evmTransaction;
  if (!tx) throw new Error("deposit quote returned no evmTransaction");
  return signAndSend(
    client,
    wallet,
    {
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gasLimit,
      nonce: tx.nonce,
    },
    chainId,
    rpcUrl
  );
}

/**
 * Executes one automation rule end to end: balance → deposit quote →
 * delegated sign/relay → tx hash. Mirrors the node SDK's earn client, but
 * signs with the user's delegated share instead of server-held shares.
 */
export async function executeRule(rule: AutomationRule): Promise<{
  status: "deposited" | "skipped";
  amount?: string;
  txHash?: string;
  reason?: string;
}> {
  const rpcUrl = rpcUrlFor(rule.chainId);
  const { amount, skipReason } = await resolveDepositAmount(rule, rpcUrl);
  if (!amount || parseFloat(amount) <= 0) {
    return { status: "skipped", reason: skipReason ?? "zero amount" };
  }

  const client = delegatedClient();
  const wallet = await loadDelegatedWallet(rule);

  const { signingPayload } = await withDelegatedServerAuth(
    client,
    (apiClient) =>
      apiClient.yieldVaultDeposit({
        vaultId: rule.vaultId,
        ownerAddress: rule.walletAddress,
        amount,
      })
  );

  const txHash = rule.sponsored
    ? await executeSponsored(client, wallet, signingPayload, rpcUrl)
    : await executeUnsponsored(client, wallet, signingPayload, rpcUrl);

  return { status: "deposited", amount, txHash };
}
