import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC4626_ABI } from "../ABIs";
import { Vault } from "./useVaultsList";

export interface VaultPosition {
  vault: Vault;
  shares: bigint;
  assets: bigint;
  assetsFormatted: string;
}

export function useVaultPositions(address: string | undefined, vaults: Vault[]) {
  // Batch-read share balances for all vaults
  const { data: balances, isLoading: balancesLoading } = useReadContracts({
    contracts: vaults.map((vault) => ({
      address: vault.address as `0x${string}`,
      abi: ERC4626_ABI,
      functionName: "balanceOf" as const,
      args: [address as `0x${string}`],
    })),
    query: { enabled: !!address && vaults.length > 0 },
  });

  // Batch-read convertToAssets using the share balances above
  const { data: assetAmounts, isLoading: assetsLoading } = useReadContracts({
    contracts: vaults.map((vault, i) => ({
      address: vault.address as `0x${string}`,
      abi: ERC4626_ABI,
      functionName: "convertToAssets" as const,
      args: [(balances?.[i]?.result as bigint) ?? 0n],
    })),
    query: { enabled: !!balances && balances.some((b) => b.result && (b.result as bigint) > 0n) },
  });

  const positions: VaultPosition[] = vaults
    .map((vault, i) => {
      const shares = (balances?.[i]?.result as bigint) ?? 0n;
      const assets = (assetAmounts?.[i]?.result as bigint) ?? 0n;
      return {
        vault,
        shares,
        assets,
        assetsFormatted: formatUnits(assets, vault.assetDecimals),
      };
    })
    .filter((p) => p.shares > 0n);

  return {
    positions,
    loading: balancesLoading || assetsLoading,
  };
}
