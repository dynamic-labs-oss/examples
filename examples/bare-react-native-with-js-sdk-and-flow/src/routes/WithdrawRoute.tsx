/**
 * Address + amount withdrawal: connect MetaMask inline on this screen, then
 * MetaMask -> the typed destination address — the reverse of DepositRoute's
 * ETH-in/USDC-out. Paid in USDC from the connected wallet, settled as native
 * ETH to the destination. Same create -> attach source -> quote -> submit
 * sequence, with source/destination and the settled asset swapped.
 *
 * Replaces both the old vault-era gas-check hub (WithdrawRoute.tsx) and the
 * amount-entry screen (WithdrawAmountRoute.tsx) — there's no vault gas to
 * check anymore; MetaMask users cover their own gas the same way they
 * already do signing the deposit.
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
import { createWithdrawFlow } from '../utils/createWithdrawFlow';
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
  creating: 'Creating withdrawal…',
  attaching: 'Attaching your wallet…',
  quoting: 'Getting a quote…',
  'awaiting-approval': 'Check your wallet to approve the transaction…',
};

export function WithdrawRoute({ navigation }: RouteProps<'Withdraw'>) {
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

      const flowId = await createWithdrawFlow({
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

      // fromTokenAddress is what actually picks the connected wallet's
      // paying asset — attachFlowSource's wallet-source params have no
      // token field at all, so without this, getFlowQuote defaults to the
      // chain's native token (ETH) regardless of what the wallet holds.
      // This is the one thing that makes the connected wallet spend its
      // USDC instead of its ETH gas — confirmed against Dynamic's own
      // demo-dashboard reference (github.com/dynamic-labs-oss/demo-dashboard),
      // whose withdraw flow passes this same param for exactly this reason.
      await getFlowQuote({ flowId, fromTokenAddress: config.usdcAddress });

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

      navigation.replace('FlowStatus', { flowId, direction: 'withdraw' });
    },
    onError: () => {
      setStep('error');
      setSubmitStepLabel(null);
    },
  });

  return (
    <AddressAmountView
      title="Withdraw"
      hint={`Paid in USDC from your connected wallet on Base mainnet, settled as ETH to the address above. Capped at $${MAX_AMOUNT_USD} for this demo.`}
      address={address}
      onChangeAddress={setAddress}
      amount={amount}
      onChangeAmount={setAmount}
      isWalletConnected={!!connectedAccount}
      isConnectingWallet={isConnecting}
      onConnectWallet={handleConnect}
      onSubmit={() => handleSubmit({ amount })}
      submitLabel="Withdraw"
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
