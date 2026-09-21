/**
 * Address + amount deposit: connect MetaMask inline on this screen, then
 * MetaMask -> the typed destination address. Same create -> attach source ->
 * quote -> submit sequence this app has always used for deposits, with the
 * destination now a plain address the user types instead of a pre-existing
 * vault's address.
 */
import {
  attachFlowSource,
  getFlowQuote,
  submitFlowTransaction,
} from '@dynamic-labs-sdk/client';
import type { EvmWalletAccount } from '@dynamic-labs-sdk/evm';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { AddressAmountView } from '../views/AddressAmountView';
import { config } from '../consts/config';
import { MAX_AMOUNT_USD } from '../consts/flow';
import { createDepositFlow } from '../utils/createDepositFlow';
import { connectMetaMask } from '../utils/connectMetaMask';
import { normalizeAmount } from '../utils/normalizeAmount';
import { isValidAmount } from '../utils/isValidAmount';
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
  const [connectedAccount, setConnectedAccount] = useState<
    EvmWalletAccount | undefined
  >();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string>();
  const [step, setStep] = useState<Step>('idle');
  const [submitStepLabel, setSubmitStepLabel] = useState<string | null>(null);
  const isBusy = BUSY_STEPS.has(step);
  const canSubmit =
    !isBusy && address.trim().length > 0 && isValidAmount(amount, MAX_AMOUNT_USD);

  async function handleConnect() {
    setIsConnecting(true);
    setConnectError(undefined);
    try {
      setConnectedAccount(await connectMetaMask());
    } catch (e) {
      setConnectError(
        e instanceof Error ? e.message : 'Failed to connect wallet.',
      );
    } finally {
      setIsConnecting(false);
    }
  }

  const {
    mutate: handleSubmit,
    isPending: isSubmitting,
    error,
  } = useMutation({
    mutationFn: async ({ amount: submittedAmount }: { amount: string }) => {
      if (!connectedAccount) {
        // Unreachable in practice — canSubmit/the view only render the
        // submit action once a wallet is connected.
        throw new Error('Connect a wallet first.');
      }

      setSubmitStepLabel(null);
      setStep('creating');

      const normalizedAmount = normalizeAmount(submittedAmount);

      const flowId = await createDepositFlow({
        amount: normalizedAmount,
        destinationAddress: address.trim(),
      });

      setStep('attaching');

      await attachFlowSource({
        flowId,
        sourceType: 'wallet',
        fromAddress: connectedAccount.address,
        fromChainId: config.chainId,
        fromChainName: 'EVM',
      });

      setStep('quoting');

      await getFlowQuote({ flowId });

      setStep('awaiting-approval');

      await submitFlowTransaction({
        flowId,
        walletAccount: connectedAccount,
        onStepChange: submitStep => {
          if (submitStep === 'approval') {
            setSubmitStepLabel('Check your wallet to approve the transaction…');
          } else if (submitStep === 'transaction') {
            setSubmitStepLabel('Broadcasting transaction…');
          }
        },
      });

      navigation.replace('FlowStatus', { flowId, direction: 'deposit' });
    },
    onError: () => {
      setStep('error');
      setSubmitStepLabel(null);
    },
  });

  return (
    <AddressAmountView
      title="Deposit"
      hint={`Paid in ETH on Base mainnet from your connected wallet, settled as USDC to the address above. Capped at $${MAX_AMOUNT_USD} for this demo.`}
      address={address}
      onChangeAddress={setAddress}
      amount={amount}
      onChangeAmount={setAmount}
      isWalletConnected={!!connectedAccount}
      isConnectingWallet={isConnecting}
      onConnectWallet={handleConnect}
      onSubmit={() => handleSubmit({ amount })}
      submitLabel="Deposit"
      isSubmitting={isSubmitting}
      canSubmit={canSubmit}
      stepLabel={
        isSubmitting ? submitStepLabel ?? STEP_LABELS[step] : undefined
      }
      error={connectError ?? error?.message}
      onBack={() => navigation.goBack()}
    />
  );
}
