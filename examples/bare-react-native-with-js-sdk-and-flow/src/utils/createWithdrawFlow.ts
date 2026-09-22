import type { Chain } from '@dynamic-labs-sdk/client';
import { config } from '../consts/config';
import type { FlowChain } from '../consts/chains';

type CreateWithdrawFlowParams = {
  /** Settlement amount in USD, e.g. "0.10". */
  amount: string;
  /** The destination wallet's address — receives the chain's own coin. */
  destinationAddress: string;
  /** The chain to settle on — the same one the paying wallet is connected on. */
  chain: Chain;
  chainConfig: FlowChain;
};

/**
 * Creates a Flow withdrawal: the connected external wallet pays in USDC,
 * settled as the chain's own coin to the destination address
 * (`destinationAddress`) — the reverse of createDepositFlow.
 *
 * The process of creating your flow should be done from the backend so the
 * Dynamic API token is not exposed to the client. This is just an example of
 * how to do it from the client side.
 */
export const createWithdrawFlow = async ({
  amount,
  destinationAddress,
  chain,
  chainConfig,
}: CreateWithdrawFlowParams) => {
  const res = await fetch(
    `${config.dynamic.apiBaseUrl}/server/${config.dynamic.environmentId}/flow/withdraw`,
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
              symbol: chainConfig.native.symbol,
              tokenAddress: chainConfig.native.address,
              tokenDecimals: chainConfig.native.decimals,
              isNative: true,
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
