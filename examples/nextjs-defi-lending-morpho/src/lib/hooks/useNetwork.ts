import { useWallet } from "@/lib/providers";
import {
  getNetworkConfigOrDefault,
  isNetworkSupported,
  SUPPORTED_CHAIN_IDS,
  DEFAULT_NETWORK,
  type NetworkConfig,
} from "../networks";

export function useNetwork() {
  const { chainId, setChainId } = useWallet();

  const currentNetwork = getNetworkConfigOrDefault(chainId);
  const isSupported = isNetworkSupported(chainId);

  const switchToNetwork = async (targetChainId: number) => {
    if (targetChainId === chainId) return;
    setChainId(targetChainId);
  };

  const switchToDefault = async () => {
    await switchToNetwork(DEFAULT_NETWORK);
  };

  return {
    chainId,
    currentNetwork,
    isSupported,
    isSwitching: false,
    switchToNetwork,
    switchToDefault,
    supportedChainIds: SUPPORTED_CHAIN_IDS,
  };
}

export function useNetworkConfig(): NetworkConfig {
  const { chainId } = useWallet();
  return getNetworkConfigOrDefault(chainId);
}
