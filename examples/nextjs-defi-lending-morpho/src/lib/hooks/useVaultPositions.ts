import { useState, useEffect } from "react";
import { formatUnits, createPublicClient, http } from "viem";
import { base, mainnet, arbitrum, optimism, polygon } from "viem/chains";
import { ERC4626_ABI } from "../ABIs";
import { Vault } from "./useVaultsList";
import { useWallet } from "@/lib/providers";

export interface VaultPosition {
  vault: Vault;
  shares: bigint;
  assets: bigint;
  assetsFormatted: string;
}

function getViemChain(chainId: number) {
  switch (chainId) {
    case mainnet.id: return mainnet;
    case arbitrum.id: return arbitrum;
    case optimism.id: return optimism;
    case polygon.id: return polygon;
    default: return base;
  }
}

export function useVaultPositions(address: string | undefined, vaults: Vault[]) {
  const { chainId } = useWallet();
  const [positions, setPositions] = useState<VaultPosition[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || vaults.length === 0) {
      setPositions([]);
      return;
    }

    async function fetchPositions() {
      setLoading(true);
      try {
        const chain = getViemChain(chainId);
        const publicClient = createPublicClient({ chain, transport: http() });

        // Batch read share balances for all vaults
        const balanceResults = await Promise.all(
          vaults.map((vault) =>
            publicClient.readContract({
              address: vault.address as `0x${string}`,
              abi: ERC4626_ABI,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            }).catch(() => 0n)
          )
        );

        // Read asset amounts for vaults with non-zero balances
        const assetResults = await Promise.all(
          vaults.map((vault, i) => {
            const shares = balanceResults[i] as bigint;
            if (shares > 0n) {
              return publicClient.readContract({
                address: vault.address as `0x${string}`,
                abi: ERC4626_ABI,
                functionName: "convertToAssets",
                args: [shares],
              }).catch(() => 0n);
            }
            return Promise.resolve(0n);
          })
        );

        const newPositions: VaultPosition[] = vaults
          .map((vault, i) => {
            const shares = balanceResults[i] as bigint;
            const assets = assetResults[i] as bigint;
            return {
              vault,
              shares,
              assets,
              assetsFormatted: formatUnits(assets, vault.assetDecimals),
            };
          })
          .filter((p) => p.shares > 0n);

        setPositions(newPositions);
      } catch {
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPositions();
  }, [address, vaults, chainId]);

  return { positions, loading };
}
