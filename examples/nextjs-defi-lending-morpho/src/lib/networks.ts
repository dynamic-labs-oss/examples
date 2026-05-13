import { base, mainnet, arbitrum, optimism, polygon } from "wagmi/chains";

export interface NetworkConfig {
  chainId: number;
  name: string;
  displayName: string;
  contracts: {
    rewardsDistributor: string;
    morphoMarkets: string;
  };
  marketParams?: {
    loanToken: string;
    collateralToken: string;
    oracle: string;
    irm: string;
    lltv: bigint;
  };
  api?: {
    morphoGraphql: string;
  };
  decimals?: {
    morpho: number;
    weth: number;
  };
}

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  // Base (Primary network)
  [base.id]: {
    chainId: base.id,
    name: "base",
    displayName: "Base",
    contracts: {
      rewardsDistributor: "0x3B14E5C73e0a56D607A8688098326fD4b4292135",
      morphoMarkets: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    },
    marketParams: {
      loanToken: "0x4200000000000000000000000000000000000006", // WETH
      collateralToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      oracle: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
      irm: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC",
      lltv: BigInt("850000000000000000"), // 85%
    },
    api: {
      morphoGraphql: "https://api.morpho.org/graphql",
    },
    decimals: {
      morpho: 18,
      weth: 18,
    },
  },
  
  // Ethereum Mainnet
  [mainnet.id]: {
    chainId: mainnet.id,
    name: "mainnet",
    displayName: "Ethereum",
    contracts: {
      rewardsDistributor: "0x3B14E5C73e0a56D607A8688098326fD4b4292135",
      morphoMarkets: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    },
    api: {
      morphoGraphql: "https://api.morpho.org/graphql",
    },
    decimals: {
      morpho: 18,
      weth: 18,
    },
  },
  
  // Arbitrum
  [arbitrum.id]: {
    chainId: arbitrum.id,
    name: "arbitrum",
    displayName: "Arbitrum",
    contracts: {
      rewardsDistributor: "0x3B14E5C73e0a56D607A8688098326fD4b4292135",
      morphoMarkets: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    },
    api: {
      morphoGraphql: "https://api.morpho.org/graphql",
    },
    decimals: {
      morpho: 18,
      weth: 18,
    },
  },
  
  // Optimism
  [optimism.id]: {
    chainId: optimism.id,
    name: "optimism",
    displayName: "Optimism",
    contracts: {
      rewardsDistributor: "0x3B14E5C73e0a56D607A8688098326fD4b4292135",
      morphoMarkets: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    },
    api: {
      morphoGraphql: "https://api.morpho.org/graphql",
    },
    decimals: {
      morpho: 18,
      weth: 18,
    },
  },
  
  // Polygon
  [polygon.id]: {
    chainId: polygon.id,
    name: "polygon",
    displayName: "Polygon",
    contracts: {
      rewardsDistributor: "0x3B14E5C73e0a56D607A8688098326fD4b4292135",
      morphoMarkets: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    },
    api: {
      morphoGraphql: "https://api.morpho.org/graphql",
    },
    decimals: {
      morpho: 18,
      weth: 18,
    },
  },
};

export const DEFAULT_NETWORK = base.id;
export const SUPPORTED_CHAIN_IDS = Object.keys(SUPPORTED_NETWORKS).map(Number);

export function getNetworkConfig(chainId: number): NetworkConfig | undefined {
  return SUPPORTED_NETWORKS[chainId];
}

export function getNetworkConfigOrDefault(chainId: number): NetworkConfig {
  return getNetworkConfig(chainId) || SUPPORTED_NETWORKS[DEFAULT_NETWORK];
}

export function isNetworkSupported(chainId: number): boolean {
  return chainId in SUPPORTED_NETWORKS;
}
