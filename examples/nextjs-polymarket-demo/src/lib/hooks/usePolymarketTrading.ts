"use client";

import { useState, useCallback, useRef } from "react";
import { useWallet } from "@/lib/providers";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { polygon } from "viem/chains";
import type { WalletClient } from "viem";
import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import type { UserOrder, UserMarketOrder } from "@polymarket/clob-client";
import { Signer, Contract, providers, BigNumber, utils } from "ethers";
import type { TypedDataDomain, TypedDataField } from "ethers";
import type { TransactionRequest } from "@ethersproject/abstract-provider";
import {
  POLYMARKET_CONTRACTS,
  POLYMARKET_USDC_SPENDERS,
  POLYMARKET_OUTCOME_TOKEN_SPENDERS,
  ERC20_APPROVAL_ABI,
  ERC1155_APPROVAL_ABI,
} from "@/lib/constants/contracts";

// Signature type for Polymarket (EOA only)
const SIGNATURE_TYPE_EOA = 0;

// Custom ethers Signer that delegates signing to a viem WalletClient directly,
// bypassing the eth_signTypedData_v4 provider round-trip which is unreliable
// across different wallet providers.
class ViemEthersSigner extends Signer {
  private readonly walletClient: WalletClient;
  private readonly _addr: string;

  constructor(walletClient: WalletClient, address: string, provider: providers.Provider) {
    super();
    this.walletClient = walletClient;
    this._addr = utils.getAddress(address);
    utils.defineReadOnly(this, "provider", provider);
  }

  async getAddress(): Promise<string> {
    return this._addr;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const raw = typeof message === "string" ? utils.toUtf8Bytes(message) : message;
    return this.walletClient.signMessage({
      account: this._addr as `0x${string}`,
      message: { raw },
    });
  }

  async _signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    const { EIP712Domain: _omit, ...filteredTypes } = types;
    const primaryType = Object.keys(filteredTypes)[0];
    return this.walletClient.signTypedData({
      account: this._addr as `0x${string}`,
      domain: {
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId !== undefined ? Number(domain.chainId) : undefined,
        verifyingContract: domain.verifyingContract as `0x${string}` | undefined,
        salt: domain.salt as `0x${string}` | undefined,
      },
      types: filteredTypes as Record<string, { name: string; type: string }[]>,
      primaryType,
      message: value as Record<string, unknown>,
    });
  }

  async signTransaction(_transaction: TransactionRequest): Promise<string> {
    throw new Error("signTransaction not supported — use sendTransaction");
  }

  async sendTransaction(transaction: TransactionRequest): Promise<providers.TransactionResponse> {
    const resolved = await utils.resolveProperties(transaction);
    const hash = await this.walletClient.sendTransaction({
      account: this._addr as `0x${string}`,
      chain: polygon,
      to: resolved.to as `0x${string}`,
      value: resolved.value ? BigInt(resolved.value.toString()) : undefined,
      data: resolved.data as `0x${string}` | undefined,
      gas: resolved.gasLimit ? BigInt(resolved.gasLimit.toString()) : undefined,
    });
    // Return a minimal TransactionResponse that ethers can work with
    return this.provider!.getTransaction(hash) as Promise<providers.TransactionResponse>;
  }

  connect(provider: providers.Provider): ViemEthersSigner {
    return new ViemEthersSigner(this.walletClient, this._addr, provider);
  }
}

// Max uint256 for unlimited approval
const MAX_ALLOWANCE = BigNumber.from(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

// Minimum allowance threshold to consider "approved" (1M USDC units = 1 USDC)
const MIN_ALLOWANCE_THRESHOLD = BigNumber.from("1000000000000");

async function ensureAllUsdcApprovals(
  signer: Signer
): Promise<{ approved: boolean; error?: string }> {
  try {
    const signerAddress = await signer.getAddress();
    const usdcContract = new Contract(
      POLYMARKET_CONTRACTS.USDC_E,
      ERC20_APPROVAL_ABI,
      signer
    );

    for (const { address } of POLYMARKET_USDC_SPENDERS) {
      const currentAllowance: BigNumber = await usdcContract.allowance(
        signerAddress,
        address
      );

      if (currentAllowance.lt(MIN_ALLOWANCE_THRESHOLD)) {
        const approveTx = await usdcContract.approve(address, MAX_ALLOWANCE);
        await approveTx.wait();
      }
    }

    return { approved: true };
  } catch (err) {
    console.error("USDC approval error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to approve USDC";
    return { approved: false, error: errorMessage };
  }
}

async function ensureAllOutcomeTokenApprovals(
  signer: Signer
): Promise<{ approved: boolean; error?: string }> {
  try {
    const signerAddress = await signer.getAddress();
    const ctfContract = new Contract(
      POLYMARKET_CONTRACTS.CTF,
      ERC1155_APPROVAL_ABI,
      signer
    );

    for (const { address } of POLYMARKET_OUTCOME_TOKEN_SPENDERS) {
      const isApproved: boolean = await ctfContract.isApprovedForAll(
        signerAddress,
        address
      );

      if (!isApproved) {
        const approveTx = await ctfContract.setApprovalForAll(address, true);
        await approveTx.wait();
      }
    }

    return { approved: true };
  } catch (err) {
    console.error("Outcome token approval error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to approve outcome tokens";
    return { approved: false, error: errorMessage };
  }
}

async function checkUsdcBalance(
  signer: Signer,
  requiredAmount: number
): Promise<{ sufficient: boolean; balance: string; error?: string }> {
  try {
    const signerAddress = await signer.getAddress();
    const usdcContract = new Contract(
      POLYMARKET_CONTRACTS.USDC_E,
      ERC20_APPROVAL_ABI,
      signer
    );

    const balance: BigNumber = await usdcContract.balanceOf(signerAddress);
    const balanceFormatted = (Number(balance.toString()) / 1e6).toFixed(2);
    const requiredBN = BigNumber.from(Math.ceil(requiredAmount * 1e6));

    if (balance.lt(requiredBN)) {
      return {
        sufficient: false,
        balance: balanceFormatted,
        error: `Insufficient USDC.e balance. You have ${balanceFormatted} USDC but need ${requiredAmount} USDC.`,
      };
    }

    return { sufficient: true, balance: balanceFormatted };
  } catch (err) {
    console.error("Balance check error:", err);
    return {
      sufficient: false,
      balance: "0",
      error: `Failed to check USDC balance: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    };
  }
}

async function ensureAllApprovals(
  signer: Signer,
  requiredAmount: number
): Promise<{ approved: boolean; error?: string }> {
  const balanceCheck = await checkUsdcBalance(signer, requiredAmount);
  if (!balanceCheck.sufficient) {
    return { approved: false, error: balanceCheck.error };
  }

  const usdcResult = await ensureAllUsdcApprovals(signer);
  if (!usdcResult.approved) {
    return usdcResult;
  }

  const outcomeResult = await ensureAllOutcomeTokenApprovals(signer);
  if (!outcomeResult.approved) {
    return outcomeResult;
  }

  return { approved: true };
}

export interface UserApiCredentials {
  key: string;
  secret: string;
  passphrase: string;
}

export interface TradeParams {
  marketId: string;
  conditionId: string;
  tokenId: string;
  side: "yes" | "no";
  amount: number;
  price?: number;
  isMarketOrder?: boolean;
  negRisk?: boolean;
}

export interface SellParams {
  tokenId: string;
  size: number;
  price?: number;
  isMarketOrder?: boolean;
  negRisk?: boolean;
}

export interface RedeemParams {
  conditionId: string;
  outcomeIndex: number;
}

export interface CancelOrderResult {
  success: boolean;
  error?: string;
}

export interface UsePolymarketTradingReturn {
  placeOrder: (
    params: TradeParams
  ) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  sellPosition: (
    params: SellParams
  ) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  redeemPosition: (
    params: RedeemParams
  ) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  cancelOrder: (orderId: string) => Promise<CancelOrderResult>;
  initializeCredentials: () => Promise<UserApiCredentials | null>;
  getClobClient: () => Promise<ClobClient | null>;
  isLoading: boolean;
  isSelling: boolean;
  isRedeeming: boolean;
  isCancelling: boolean;
  isInitialized: boolean;
  error: string | null;
}

const CLOB_API_URL = "https://clob.polymarket.com";
const POLYGON_CHAIN_ID = 137;

const CTF_REDEEM_ABI = [
  {
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "parentCollectionId", type: "bytes32" },
      { name: "conditionId", type: "bytes32" },
      { name: "indexSets", type: "uint256[]" },
    ],
    name: "redeemPositions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function usePolymarketTrading(): UsePolymarketTradingReturn {
  const { evmAccount } = useWallet();

  const [isLoading, setIsLoading] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clobClientRef = useRef<ClobClient | null>(null);
  const signerRef = useRef<ViemEthersSigner | null>(null);
  const credentialsRef = useRef<UserApiCredentials | null>(null);
  const lastWalletAddressRef = useRef<string | null>(null);

  const address = evmAccount?.address;

  const getEthersSigner =
    useCallback(async (): Promise<ViemEthersSigner | null> => {
      if (!evmAccount) {
        signerRef.current = null;
        return null;
      }

      if (lastWalletAddressRef.current !== evmAccount.address) {
        signerRef.current = null;
        credentialsRef.current = null;
        lastWalletAddressRef.current = evmAccount.address;
      }

      if (signerRef.current) {
        return signerRef.current as ViemEthersSigner;
      }

      try {
        const walletClient = await createWalletClientForWalletAccount({
          walletAccount: evmAccount,
        });
        const rpcProvider = new providers.JsonRpcProvider(
          "https://polygon-rpc.com",
          { chainId: polygon.id, name: polygon.name }
        );
        signerRef.current = new ViemEthersSigner(walletClient, evmAccount.address, rpcProvider);
        return signerRef.current as ViemEthersSigner;
      } catch (err) {
        console.error("Failed to create signer:", err);
        signerRef.current = null;
        return null;
      }
    }, [evmAccount]);

  const initializeCredentials =
    useCallback(async (): Promise<UserApiCredentials | null> => {
      const ethersSigner = await getEthersSigner();

      if (!ethersSigner || !address) {
        setError("Wallet not connected");
        return null;
      }

      if (credentialsRef.current) {
        return credentialsRef.current;
      }

      setIsLoading(true);
      setError(null);

      try {
        const tempClient = new ClobClient(
          CLOB_API_URL,
          POLYGON_CHAIN_ID,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ethersSigner as any
        );

        let credentials: UserApiCredentials | null = null;
        let deriveError: unknown;

        try {
          const derivedCreds = await tempClient.deriveApiKey();
          if (derivedCreds?.key && derivedCreds?.secret && derivedCreds?.passphrase) {
            credentials = derivedCreds;
          }
        } catch (err) {
          deriveError = err;
          console.warn("deriveApiKey failed, attempting createApiKey:", err);
        }

        if (!credentials) {
          const newCreds = await tempClient.createApiKey();
          if (newCreds?.key && newCreds?.secret && newCreds?.passphrase) {
            credentials = newCreds;
          } else {
            const errMsg = deriveError instanceof Error ? deriveError.message : String(deriveError);
            throw new Error(`Failed to create API credentials. Cause: ${errMsg}`);
          }
        }

        credentialsRef.current = credentials;
        setIsLoading(false);
        return credentials;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to initialize credentials";
        console.error("Credential initialization error:", err);
        setError(errorMessage);
        setIsLoading(false);
        return null;
      }
    }, [getEthersSigner, address]);

  const placeOrder = useCallback(
    async (
      params: TradeParams
    ): Promise<{ success: boolean; orderId?: string; error?: string }> => {
      if (!address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsLoading(true);
      setError(null);

      const ethersSigner = await getEthersSigner();
      if (!ethersSigner) {
        setIsLoading(false);
        return { success: false, error: "Failed to get wallet signer" };
      }

      const credentials =
        credentialsRef.current || (await initializeCredentials());
      if (!credentials) {
        setIsLoading(false);
        return {
          success: false,
          error: "Failed to initialize trading credentials. Please try again.",
        };
      }

      let client: ClobClient;
      try {
        client = new ClobClient(
          CLOB_API_URL,
          POLYGON_CHAIN_ID,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ethersSigner as any,
          credentials,
          SIGNATURE_TYPE_EOA
        );
      } catch (err) {
        console.error("Failed to create trading client:", err);
        setIsLoading(false);
        return { success: false, error: "Failed to create trading client" };
      }

      const approvalResult = await ensureAllApprovals(
        ethersSigner,
        params.amount
      );
      if (!approvalResult.approved) {
        setIsLoading(false);
        return { success: false, error: approvalResult.error };
      }

      try {
        const side = Side.BUY;
        let response;

        if (params.isMarketOrder) {
          const marketOrder: UserMarketOrder = {
            tokenID: params.tokenId,
            amount: params.amount,
            side,
            feeRateBps: 0,
          };

          response = await client.createAndPostMarketOrder(
            marketOrder,
            { negRisk: params.negRisk },
            OrderType.FOK
          );
        } else {
          if (!params.price) {
            throw new Error("Price required for limit orders");
          }

          const size = params.amount / params.price;

          const order: UserOrder = {
            tokenID: params.tokenId,
            price: params.price,
            size,
            side,
            feeRateBps: 0,
            expiration: 0,
            taker: "0x0000000000000000000000000000000000000000",
          };

          response = await client.createAndPostOrder(
            order,
            { negRisk: params.negRisk },
            OrderType.GTC
          );
        }

        const orderId =
          response.orderID ||
          response.orderId ||
          response.order_id ||
          response.id;
        if (orderId) {
          setIsLoading(false);
          return { success: true, orderId };
        } else if (response.success || response.status === "success") {
          setIsLoading(false);
          return { success: true, orderId: "pending" };
        } else if (response.error || response.message) {
          throw new Error(response.error || response.message);
        } else {
          throw new Error(
            `Order submission failed - unexpected response: ${JSON.stringify(
              response
            )}`
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to place order";
        console.error("Polymarket trading error:", err);
        setError(errorMessage);
        setIsLoading(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, getEthersSigner, initializeCredentials]
  );

  const sellPosition = useCallback(
    async (
      params: SellParams
    ): Promise<{ success: boolean; orderId?: string; error?: string }> => {
      if (!address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsSelling(true);
      setError(null);

      const ethersSigner = await getEthersSigner();
      if (!ethersSigner) {
        setIsSelling(false);
        return { success: false, error: "Failed to get wallet signer" };
      }

      const credentials =
        credentialsRef.current || (await initializeCredentials());
      if (!credentials) {
        setIsSelling(false);
        return {
          success: false,
          error: "Failed to initialize trading credentials. Please try again.",
        };
      }

      let client: ClobClient;
      try {
        client = new ClobClient(
          CLOB_API_URL,
          POLYGON_CHAIN_ID,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ethersSigner as any,
          credentials,
          SIGNATURE_TYPE_EOA
        );
      } catch (err) {
        console.error("Failed to create trading client:", err);
        setIsSelling(false);
        return { success: false, error: "Failed to create trading client" };
      }

      const outcomeApprovalResult = await ensureAllOutcomeTokenApprovals(
        ethersSigner
      );
      if (!outcomeApprovalResult.approved) {
        setIsSelling(false);
        return { success: false, error: outcomeApprovalResult.error };
      }

      try {
        const side = Side.SELL;
        let response;

        if (params.isMarketOrder) {
          const marketOrder: UserMarketOrder = {
            tokenID: params.tokenId,
            amount: params.size,
            side,
            feeRateBps: 0,
          };

          response = await client.createAndPostMarketOrder(
            marketOrder,
            { negRisk: params.negRisk },
            OrderType.FOK
          );
        } else {
          if (!params.price) {
            throw new Error("Price required for limit orders");
          }

          const order: UserOrder = {
            tokenID: params.tokenId,
            price: params.price,
            size: params.size,
            side,
            feeRateBps: 0,
            expiration: 0,
            taker: "0x0000000000000000000000000000000000000000",
          };

          response = await client.createAndPostOrder(
            order,
            { negRisk: params.negRisk },
            OrderType.GTC
          );
        }

        const orderId =
          response.orderID ||
          response.orderId ||
          response.order_id ||
          response.id;
        if (orderId) {
          setIsSelling(false);
          return { success: true, orderId };
        } else if (response.success || response.status === "success") {
          setIsSelling(false);
          return { success: true, orderId: "pending" };
        } else if (response.error || response.message) {
          throw new Error(response.error || response.message);
        } else {
          throw new Error(
            `Sell order failed - unexpected response: ${JSON.stringify(
              response
            )}`
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to sell position";
        console.error("Polymarket sell error:", err);
        setError(errorMessage);
        setIsSelling(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, getEthersSigner, initializeCredentials]
  );

  const redeemPosition = useCallback(
    async (
      params: RedeemParams
    ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      if (!address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsRedeeming(true);
      setError(null);

      const ethersSigner = await getEthersSigner();
      if (!ethersSigner) {
        setIsRedeeming(false);
        return { success: false, error: "Failed to get wallet signer" };
      }

      try {
        const ctfContract = new Contract(
          POLYMARKET_CONTRACTS.CTF,
          CTF_REDEEM_ABI,
          ethersSigner
        );

        const parentCollectionId = "0x" + "0".repeat(64);
        const indexSet = BigNumber.from(1).shl(params.outcomeIndex);

        const tx = await ctfContract.redeemPositions(
          POLYMARKET_CONTRACTS.USDC_E,
          parentCollectionId,
          params.conditionId,
          [indexSet]
        );

        const receipt = await tx.wait();
        setIsRedeeming(false);
        return { success: true, txHash: receipt.transactionHash };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to redeem position";
        console.error("Redeem position error:", err);
        setError(errorMessage);
        setIsRedeeming(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, getEthersSigner]
  );

  const getClobClient = useCallback(async (): Promise<ClobClient | null> => {
    if (clobClientRef.current) {
      return clobClientRef.current;
    }

    const ethersSigner = await getEthersSigner();
    if (!ethersSigner) {
      return null;
    }

    const credentials =
      credentialsRef.current || (await initializeCredentials());
    if (!credentials) {
      return null;
    }

    try {
      const client = new ClobClient(
        CLOB_API_URL,
        POLYGON_CHAIN_ID,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ethersSigner as any,
        credentials,
        SIGNATURE_TYPE_EOA
      );
      clobClientRef.current = client;
      return client;
    } catch (err) {
      console.error("Failed to create CLOB client:", err);
      return null;
    }
  }, [getEthersSigner, initializeCredentials]);

  const cancelOrder = useCallback(
    async (orderId: string): Promise<CancelOrderResult> => {
      if (!address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsCancelling(true);
      setError(null);

      try {
        const client = await getClobClient();
        if (!client) {
          setIsCancelling(false);
          return {
            success: false,
            error: "Failed to initialize trading client",
          };
        }

        await client.cancelOrder({ orderID: orderId });
        setIsCancelling(false);
        return { success: true };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to cancel order";
        console.error("Cancel order error:", err);
        setError(errorMessage);
        setIsCancelling(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, getClobClient]
  );

  return {
    placeOrder,
    sellPosition,
    redeemPosition,
    cancelOrder,
    initializeCredentials,
    getClobClient,
    isLoading,
    isSelling,
    isRedeeming,
    isCancelling,
    isInitialized: !!credentialsRef.current,
    error,
  };
}
