import { useChainId, useSwitchChain } from "wagmi";
import {
  getNetworkConfigOrDefault,
  isNetworkSupported,
  SUPPORTED_CHAIN_IDS,
  DEFAULT_NETWORK,
  type NetworkConfig,
} from "../networks";

export function useNetwork() {
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const currentNetwork = getNetworkConfigOrDefault(chainId);
  const isSupported = isNetworkSupported(chainId);

  const switchToNetwork = async (targetChainId: number) => {
    if (targetChainId === chainId) return;

    try {
      await switchChain({
        chainId: targetChainId as 1 | 10 | 8453 | 42161 | 137,
      });
    } catch (error) {
      console.error("Failed to switch network:", error);
      throw error;
    }
  };

  const switchToDefault = async () => {
    await switchToNetwork(DEFAULT_NETWORK);
  };

  return {
    chainId,
    currentNetwork,
    isSupported,
    isSwitching,
    switchToNetwork,
    switchToDefault,
    supportedChainIds: SUPPORTED_CHAIN_IDS,
  };
}

export function useNetworkConfig(): NetworkConfig {
  const chainId = useChainId();
  return getNetworkConfigOrDefault(chainId);
}
