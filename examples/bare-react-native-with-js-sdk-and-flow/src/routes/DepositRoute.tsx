/**
 * Address + amount deposit: the connected wallet pays, the typed destination
 * address receives. Same create -> attach source -> quote -> submit sequence
 * this app has always used for deposits, with the destination now a plain
 * address the user types instead of a pre-existing vault's address.
 *
 * The wallet comes from the connect screen rather than being connected here,
 * so one connection serves both directions.
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
import { createDepositFlow } from '../utils/createDepositFlow';
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
  creating: 'Creating deposit…',
  attaching: 'Attaching your wallet…',
  quoting: 'Getting a quote…',
  'awaiting-approval': 'Check your wallet to approve the transaction…',
};

export function DepositRoute({ navigation }: RouteProps<'Deposit'>) {
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

      const flowId = await createDepositFlow({
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

      await getFlowQuote({ flowId });

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

      navigation.replace('FlowStatus', { chain, direction: 'deposit', flowId });
    },
    onError: () => {
      setStep('error');
      setSubmitStepLabel(null);
    },
  });

  return (
    <AddressAmountView
      title="Deposit"
      hint={
        chainConfig
          ? `Paid in ${chainConfig.native.symbol} on ${chainConfig.label} from your connected wallet, settled as USDC to the address above. Capped at $${MAX_AMOUNT_USD} for this demo.`
          : `Connect a wallet on ${SUPPORTED_CHAIN_LABELS} to deposit. Capped at $${MAX_AMOUNT_USD} for this demo.`
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
      submitLabel="Deposit"
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
