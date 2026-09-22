import type { Chain } from '@dynamic-labs-sdk/client';
import { config } from '../consts/config';
import type { FlowChain } from '../consts/chains';

type CreateDepositFlowParams = {
  /** Settlement amount in USD, e.g. "0.10". */
  amount: string;
  /** The destination address — receives USDC. */
  destinationAddress: string;
  /** The chain to settle on — the same one the paying wallet is connected on. */
  chain: Chain;
  chainConfig: FlowChain;
};

/**
 * Creates a Flow deposit: the connected external wallet pays in the chain's
 * own coin, settled as USDC to the destination address
 * (`destinationAddress`).
 *
 * The process of creating your flow should be done from the backend so the
 * Dynamic API token is not exposed to the client. This is just an example of
 * how to do it from the client side.
 */
export const createDepositFlow = async ({
  amount,
  destinationAddress,
  chain,
  chainConfig,
}: CreateDepositFlowParams) => {
  const res = await fetch(
    `${config.dynamic.apiBaseUrl}/server/${config.dynamic.environmentId}/flow/deposit`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.dynamic.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'USD',
        settlementConfig: {
          strategy: 'cheapest',
          settlements: [
            {
              chainName: chain,
              chainId: chainConfig.chainId,
              symbol: chainConfig.usdc.symbol,
              tokenAddress: chainConfig.usdc.address,
              tokenDecimals: chainConfig.usdc.decimals,
            },
          ],
        },
        destinationConfig: {
          destinations: [
            {
              chainName: chain,
              type: 'address',
              identifier: destinationAddress,
            },
          ],
        },
      }),
    },
  );
  const { flow } = (await res.json()) as { flow: { id: string } };

  return flow.id;
};
