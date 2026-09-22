/**
 * Address + amount withdrawal — the reverse of DepositRoute's ETH-in/USDC-out.
 * Paid in USDC from the connected wallet, settled as native ETH to the typed
 * destination. Same create -> attach source -> quote -> submit sequence, with
 * source/destination and the settled asset swapped.
 *
 * Replaces both the old vault-era gas-check hub (WithdrawRoute.tsx) and the
 * amount-entry screen (WithdrawAmountRoute.tsx) — there's no vault gas to
 * check anymore; the user covers their own gas the same way they already do
 * signing the deposit.
 */
import {
  attachFlowSource,
  getFlowQuote,
  submitFlowTransaction,
} from '@dynamic-labs-sdk/client';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { AddressAmountView } from '../views/AddressAmountView';
import { FLOW_CHAINS, SUPPORTED_CHAIN_LABELS } from '../consts/chains';
import { MAX_AMOUNT_USD } from '../consts/flow';
import { createWithdrawFlow } from '../utils/createWithdrawFlow';
import { normalizeAmount } from '../utils/normalizeAmount';
import { isValidAddressForChain } from '../utils/isValidAddressForChain';
import { isValidAmount } from '../utils/isValidAmount';
import { useConnectedWallet } from '../state/connectedWallet';
import type { RouteProps } from '../navigation';

type Step =
  | 'idle'
  | 'creating'
  | 'attaching'
  | 'quoting'
  | 'awaiting-approval'
  | 'error';

const BUSY_STEPS: ReadonlySet<Step> = new Set([
  'creating',
  'attaching',
  'quoting',
  'awaiting-approval',
]);

const STEP_LABELS: Partial<Record<Step, string>> = {
  creating: 'Creating withdrawal…',
  attaching: 'Attaching your wallet…',
  quoting: 'Getting a quote…',
  'awaiting-approval': 'Check your wallet to approve the transaction…',
};

export function WithdrawRoute({ navigation }: RouteProps<'Withdraw'>) {
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const { connectedWallet, disconnect } = useConnectedWallet();
  const chain = connectedWallet?.account.chain;
  const chainConfig = chain && FLOW_CHAINS[chain];
  const [step, setStep] = useState<Step>('idle');
  const [submitStepLabel, setSubmitStepLabel] = useState<string | null>(null);
  const isBusy = BUSY_STEPS.has(step);
  // A destination typed for the previous wallet's chain survives a
  // reconnect, so the shape is checked against the chain in play now.
  const isAddressWrongForChain =
    !!chain &&
    address.trim().length > 0 &&
    !isValidAddressForChain(address, chain);
  const canSubmit =
    !isBusy &&
    !!chainConfig &&
    address.trim().length > 0 &&
    !isAddressWrongForChain &&
    isValidAmount(amount, MAX_AMOUNT_USD);

  const {
    mutate: handleSubmit,
    isPending: isSubmitting,
    error,
  } = useMutation({
    mutationFn: async ({ amount: submittedAmount }: { amount: string }) => {
      if (!connectedWallet || !chain || !chainConfig) {
        // Unreachable in practice — canSubmit/the view only render the
        // submit action once a wallet on a supported chain is connected.
        throw new Error('Connect a wallet first.');
      }

      setSubmitStepLabel(null);
      setStep('creating');

      const normalizedAmount = normalizeAmount(submittedAmount);

      const flowId = await createWithdrawFlow({
        amount: normalizedAmount,
        chain,
        chainConfig,
        destinationAddress: address.trim(),
      });

      setStep('attaching');

      await attachFlowSource({
        flowId,
        sourceType: 'wallet',
        fromAddress: connectedWallet.account.address,
        fromChainId: chainConfig.chainId,
        fromChainName: chain,
      });

      setStep('quoting');

      // fromTokenAddress is what actually picks the connected wallet's
      // paying asset — attachFlowSource's wallet-source params have no
      // token field at all, so without this, getFlowQuote defaults to the
      // chain's native token (ETH) regardless of what the wallet holds.
      // This is the one thing that makes the connected wallet spend its
      // USDC instead of its ETH gas — confirmed against Dynamic's own
      // demo-dashboard reference (github.com/dynamic-labs-oss/demo-dashboard),
      // whose withdraw flow passes this same param for exactly this reason.
      await getFlowQuote({
        flowId,
        fromTokenAddress: chainConfig.usdc.address,
      });

      setStep('awaiting-approval');

      await submitFlowTransaction({
        flowId,
        walletAccount: connectedWallet.account,
        onStepChange: submitStep => {
          if (submitStep === 'approval') {
            setSubmitStepLabel('Check your wallet to approve the transaction…');
          } else if (submitStep === 'transaction') {
            setSubmitStepLabel('Broadcasting transaction…');
          }
        },
      });

      navigation.replace('FlowStatus', {
        chain,
        direction: 'withdraw',
        flowId,
      });
    },
    onError: () => {
      setStep('error');
      setSubmitStepLabel(null);
    },
  });

  return (
    <AddressAmountView
      title="Withdraw"
      hint={
        chainConfig
          ? `Paid in USDC from your connected wallet on ${chainConfig.label}, settled as ${chainConfig.native.symbol} to the address above. Capped at $${MAX_AMOUNT_USD} for this demo.`
          : `Connect a wallet on ${SUPPORTED_CHAIN_LABELS} to withdraw. Capped at $${MAX_AMOUNT_USD} for this demo.`
      }
      addressPlaceholder={chainConfig?.addressPlaceholder ?? '0x…'}
      addressErrorText={
        isAddressWrongForChain && chainConfig
          ? `That does not look like a ${chainConfig.label} address.`
          : undefined
      }
      address={address}
      onChangeAddress={setAddress}
      amount={amount}
      onChangeAmount={setAmount}
      connectedWallet={
        connectedWallet && {
          address: connectedWallet.account.address,
          name: connectedWallet.option.name,
        }
      }
      onConnectWallet={() => navigation.navigate('ConnectWallet')}
      onDisconnectWallet={disconnect}
      onSubmit={() => handleSubmit({ amount })}
      submitLabel="Withdraw"
      isSubmitting={isSubmitting}
      canSubmit={canSubmit}
      stepLabel={
        isSubmitting ? submitStepLabel ?? STEP_LABELS[step] : undefined
      }
      error={error?.message}
      onBack={() => navigation.goBack()}
    />
  );
}
