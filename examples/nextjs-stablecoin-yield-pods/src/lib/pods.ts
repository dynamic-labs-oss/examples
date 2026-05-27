import type {
  Strategy,
  Position,
  WalletPositions,
  StrategyDetailResponse,
  BytecodeResponse,
  StrategiesResponse,
  RawWalletPosition,
  RawWalletPositions,
} from "./pods-types";

const PODS_API_BASE =
  process.env.NEXT_PUBLIC_PODS_API_URL || "https://api.deframe.io";
const PODS_API_KEY = process.env.NEXT_PUBLIC_PODS_API_KEY;

if (!PODS_API_KEY) {
  throw new Error(
    "NEXT_PUBLIC_PODS_API_KEY is not set in environment variables"
  );
}

async function fetchFromPodsAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${PODS_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": PODS_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pods API error: ${error}`);
  }

  return response.json();
}

export async function getStrategies(
  chainId?: number,
  limit?: number
): Promise<StrategiesResponse> {
  const queryParams = new URLSearchParams();
  if (limit) queryParams.set("limit", limit.toString());

  const endpoint = `/strategies${
    queryParams.toString() ? `?${queryParams.toString()}` : ""
  }`;
  const response = await fetchFromPodsAPI<StrategiesResponse>(endpoint);

  if (chainId) {
    return {
      ...response,
      data: response.data.filter(
        (strategy) => parseInt(strategy.networkId) === chainId
      ),
    };
  }

  return response;
}

export async function getStrategy(strategyId: string): Promise<Strategy> {
  const endpoint = `/strategies/${strategyId}`;
  const response = await fetchFromPodsAPI<StrategyDetailResponse>(endpoint);
  return {
    ...response.strategy,
    spotPosition: response.spotPosition,
  };
}

export async function getDepositBytecode(params: {
  strategyId: string;
  chainId: number;
  amount: string;
  asset: string;
  wallet: string;
}): Promise<BytecodeResponse> {
  const { strategyId, chainId, amount, asset, wallet } = params;

  const queryParams = new URLSearchParams({
    action: "lend",
    chainId: chainId.toString(),
    amount,
    asset,
    wallet,
  });

  const endpoint = `/strategies/${strategyId}/bytecode?${queryParams.toString()}`;
  return fetchFromPodsAPI<BytecodeResponse>(endpoint);
}

export async function getWithdrawBytecode(params: {
  strategyId: string;
  chainId: number;
  amount: string;
  asset: string;
  wallet: string;
}): Promise<BytecodeResponse> {
  const { strategyId, chainId, amount, asset, wallet } = params;

  const queryParams = new URLSearchParams({
    action: "withdraw",
    chainId: chainId.toString(),
    amount,
    asset,
    wallet,
  });

  const endpoint = `/strategies/${strategyId}/bytecode?${queryParams.toString()}`;
  return fetchFromPodsAPI<BytecodeResponse>(endpoint);
}

export async function getYieldStrategies(params: {
  currency: string;
  chainId: number;
  action?: "lend" | "withdraw";
  amount?: string;
  asset?: string;
  wallet?: string;
}): Promise<Strategy | BytecodeResponse> {
  const { currency, chainId, action, amount, asset, wallet } = params;

  const queryParams = new URLSearchParams({
    chainId: chainId.toString(),
  });

  if (action) queryParams.set("action", action);
  if (amount) queryParams.set("amount", amount);
  if (asset) queryParams.set("asset", asset);
  if (wallet) queryParams.set("wallet", wallet);

  const endpoint = `/yield/${currency}?${queryParams.toString()}`;

  if (action === "lend" || action === "withdraw") {
    return fetchFromPodsAPI<BytecodeResponse>(
      endpoint
    ) as Promise<BytecodeResponse>;
  } else {
    return fetchFromPodsAPI<Strategy>(endpoint) as Promise<Strategy>;
  }
}

export async function getWalletPositions(
  address: string
): Promise<WalletPositions> {
  const raw = await fetchFromPodsAPI<RawWalletPositions>(`/wallets/${address}`, { cache: "no-store" });
  const positions: Position[] = (raw?.positions ?? []).map((p: RawWalletPosition) => {
    const strat = p.strategy ?? {};
    const spot = p.spotPosition;
    const cur = spot?.currentPosition;

    const decimals = String(strat.assetDecimals ?? 18);
    // balance lives in spotPosition.currentPosition, already human-readable
    const balanceRaw = cur?.value ?? p.balance ?? "0";
    const humanized = cur?.humanized != null ? Number(cur.humanized) : Number(p.balance ?? "0");
    const assetAddress = strat.asset ?? "";
    const assetSymbol = strat.assetName ?? cur?.symbol ?? "";

    return {
      name: strat.assetName ?? strat.name ?? "",
      protocol: strat.protocol ?? "",
      asset: {
        address: assetAddress,
        decimals,
        symbol: assetSymbol,
        name: strat.assetName ?? strat.name ?? "",
      },
      balance: {
        raw: balanceRaw,
        humanized: isFinite(humanized) ? humanized : 0,
        decimals,
      },
      balanceUSD: String(spot?.underlyingBalanceUSD ?? p.balanceUSD ?? "0"),
      earnedUSD: String(spot?.profit?.humanized ?? p.earnedUSD ?? "0"),
      apy: String(spot?.apy ?? strat.apy ?? 0),
      strategyId: strat._id ?? strat.id ?? strat.slug ?? "",
    };
  });

  return { address, positions };
}

export const client = {
  getStrategies,
  getStrategy,
  getDepositBytecode,
  getWithdrawBytecode,
  getYieldStrategies,
  getWalletPositions,
};
