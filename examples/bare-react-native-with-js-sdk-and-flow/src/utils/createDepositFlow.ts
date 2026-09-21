import { config } from '../consts/config';

type CreateDepositFlowParams = {
  /** Settlement amount in USD, e.g. "0.10". */
  amount: string;
  /** The destination address — receives USDC. */
  destinationAddress: string;
};

/**
 * Creates a Flow deposit: the connected external wallet pays in ETH on Base
 * mainnet, settled as USDC to the destination address (`destinationAddress`).
 *
 * The process of creating your flow should be done from the backend so the
 * Dynamic API token is not exposed to the client. This is just an example of
 * how to do it from the client side.
 */
export const createDepositFlow = async ({
  amount,
  destinationAddress,
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
              chainName: 'EVM',
              chainId: config.chainId,
              symbol: 'USDC',
              tokenAddress: config.usdcAddress,
              tokenDecimals: 6,
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
