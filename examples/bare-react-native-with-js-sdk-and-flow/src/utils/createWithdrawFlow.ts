import { config } from '../consts/config';

type CreateWithdrawFlowParams = {
  /** Settlement amount in USD, e.g. "0.10". */
  amount: string;
  /** The destination wallet's address — receives native ETH. */
  destinationAddress: string;
};

/**
 * Creates a Flow withdrawal: the connected external wallet pays in USDC,
 * settled as native ETH on Base mainnet to the destination address
 * (`destinationAddress`) — the reverse of createDepositFlow's
 * ETH-in/USDC-out.
 *
 * The process of creating your flow should be done from the backend so the
 * Dynamic API token is not exposed to the client. This is just an example of
 * how to do it from the client side.
 */
export const createWithdrawFlow = async ({
  amount,
  destinationAddress,
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
              chainName: 'EVM',
              chainId: config.chainId,
              symbol: 'ETH',
              tokenAddress: '0x0000000000000000000000000000000000000000',
              tokenDecimals: 18,
              isNative: true,
            },
          ],
        },
        destinationConfig: {
          destinations: [
            {
              chainName: 'EVM',
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
