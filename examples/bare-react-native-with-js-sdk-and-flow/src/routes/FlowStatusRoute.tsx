/**
 * Tracks a submitted Flow from broadcast through settlement — the "smart"
 * half of the pre-redesign FlowStatusScreen.tsx, porting its polling/
 * derived-state logic (buildSteps, the execution/settlement/risk label
 * maps, the isFailure-before-isComplete resolution order) to feed
 * FlowStatusView's props instead of rendering its own markup. See
 * FlowStatusView.tsx's own top-of-file comment for the full rationale
 * behind each of these — this file only recomputes the *data*, not the
 * reasoning; that lives with the view now.
 */
import type {
  Flow,
  FlowExecutionState,
  FlowSettlementState,
} from '@dynamic-labs-sdk/client';
import { useCancelFlow, useGetFlow } from '@dynamic-labs-sdk/react-hooks';
import { FlowStatusView, type Step } from '../views/FlowStatusView';
import type { RouteProps } from '../navigation';

const EXECUTION_ORDER: FlowExecutionState[] = [
  'initiated',
  'source_attached',
  'quoted',
  'signing',
  'broadcasted',
  'source_confirmed',
];

const PRE_BROADCAST_STATES: FlowExecutionState[] = [
  'initiated',
  'source_attached',
  'quoted',
  'signing',
];

const EXECUTION_LABELS: Record<FlowExecutionState, string> = {
  initiated: 'Initiated',
  source_attached: 'Wallet attached',
  quoted: 'Quote received',
  signing: 'Awaiting your signature',
  broadcasted: 'Broadcast to Base',
  source_confirmed: 'Source transaction confirmed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  failed: 'Failed',
};

const SETTLEMENT_LABELS: Record<FlowSettlementState, string> = {
  none: 'Not started',
  routing: 'Routing',
  bridging: 'Bridging',
  swapping: 'Swapping assets',
  settling: 'Settling',
  completed: 'Completed',
  failed: 'Failed',
};

const RISK_LABELS: Record<Flow['riskState'], string> = {
  unknown: 'Unknown',
  pending: 'Screening in progress',
  cleared: 'Cleared',
  blocked: 'Blocked',
  review: 'Under review',
};

const SETTLEMENT_STEP_DESCRIPTIONS: Record<FlowSettlementState, string> = {
  none: 'Preparing to route your funds to the destination.',
  routing: 'Routing your funds to the destination.',
  bridging: 'Bridging your funds across chains.',
  swapping: 'Swapping assets.',
  settling: 'Finalizing the transfer.',
  completed: 'Funds have landed.',
  failed: 'Settlement failed.',
};

function buildSteps(flow: Flow, direction: 'deposit' | 'withdraw'): Step[] {
  const execIndex = EXECUTION_ORDER.indexOf(flow.executionState);
  const isBroadcasted = execIndex >= EXECUTION_ORDER.indexOf('broadcasted');
  const isSourceConfirmed =
    execIndex >= EXECUTION_ORDER.indexOf('source_confirmed');
  const isSettlementStarted = flow.settlementState !== 'none';
  const isSettled = flow.settlementState === 'completed';

  return [
    {
      key: 'broadcast',
      title: 'Broadcast to Base',
      description: isBroadcasted
        ? 'Sent to the Base network.'
        : flow.executionState === 'signing'
        ? 'Waiting for you to confirm in your wallet.'
        : 'Preparing your transaction.',
      status: isBroadcasted ? 'completed' : 'active',
    },
    {
      key: 'confirm',
      title: 'Confirm on Base',
      description: 'Waiting for the network to confirm your transaction.',
      status: isSourceConfirmed
        ? 'completed'
        : isBroadcasted
        ? 'active'
        : 'pending',
    },
    {
      key: 'settle',
      title: 'Convert & route',
      description: SETTLEMENT_STEP_DESCRIPTIONS[flow.settlementState],
      status: isSettled
        ? 'completed'
        : isSourceConfirmed || isSettlementStarted
        ? 'active'
        : 'pending',
    },
    {
      key: 'complete',
      title:
        direction === 'deposit' ? 'Deposit complete' : 'Withdrawal complete',
      description:
        direction === 'deposit'
          ? 'USDC has landed at the destination address.'
          : 'ETH has landed at the destination address.',
      status: isSettled ? 'completed' : 'pending',
    },
  ];
}

export function FlowStatusRoute({
  navigation,
  route,
}: RouteProps<'FlowStatus'>) {
  const { flowId, direction } = route.params;
  const noun = direction === 'deposit' ? 'Deposit' : 'Withdrawal';

  const {
    data: flow,
    isPending,
    isError,
    refetch,
    error,
  } = useGetFlow({
    flowId,
    // Simple fixed 3s poll — this keeps polling even once the flow reaches
    // a terminal state, unlike the previous refetchInterval callback that
    // stopped polling there. Simplicity was chosen over that optimization
    // here; a few extra background polls a terminal flow doesn't move on
    // from is a fine trade-off for a demo app.
    queryParams: { refetchInterval: 3000 },
  });

  const {
    mutate: cancelFlowMutate,
    isPending: isCancelling,
    error: cancelError,
  } = useCancelFlow({ mutateParams: { onSuccess: () => refetch() } });

  const onDone = () =>
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });

  if (isPending) {
    return (
      <FlowStatusView
        direction={direction}
        isLoading
        onRetryLoad={() => refetch()}
        onGiveUp={onDone}
        onDone={onDone}
      />
    );
  }

  // Gated on `!flow`, not just `isError` — see FlowStatusView.tsx's
  // top-of-file comment on why a transient background-poll error shouldn't
  // blow away a perfectly healthy cached step list.
  if (isError && !flow) {
    const message =
      error instanceof Error
        ? error.message
        : `Failed to load ${noun.toLowerCase()} status.`;
    return (
      <FlowStatusView
        direction={direction}
        isLoading={false}
        loadError={message}
        onRetryLoad={() => refetch()}
        onGiveUp={onDone}
        onDone={onDone}
      />
    );
  }

  if (!flow) {
    return null;
  }

  const isFailure =
    flow.executionState === 'cancelled' ||
    flow.executionState === 'expired' ||
    flow.executionState === 'failed' ||
    flow.settlementState === 'failed';
  const isComplete = !isFailure && flow.settlementState === 'completed';
  const isCancellable = PRE_BROADCAST_STATES.includes(flow.executionState);

  const failureTitle =
    flow.executionState === 'cancelled'
      ? `${noun} cancelled`
      : flow.executionState === 'expired'
      ? `${noun} expired`
      : `${noun} failed`;
  const isMutedFailure =
    flow.executionState === 'cancelled' || flow.executionState === 'expired';
  const failureDescription =
    flow.executionState === 'cancelled'
      ? `You cancelled this ${noun.toLowerCase()} before it was broadcast.`
      : flow.executionState === 'expired'
      ? `This ${noun.toLowerCase()} timed out before it was broadcast. Start a new one from Home.`
      : flow.failure?.message ??
        `Something went wrong processing this ${noun.toLowerCase()}.`;
  const failureHint =
    !isMutedFailure && flow.failure?.retryable
      ? `This step can be retried — start a new ${noun.toLowerCase()} from Home.`
      : undefined;

  return (
    <FlowStatusView
      direction={direction}
      isLoading={false}
      onRetryLoad={() => refetch()}
      onGiveUp={onDone}
      riskState={flow.riskState}
      isStale={isError}
      isComplete={isComplete}
      isFailure={isFailure}
      failureTitle={failureTitle}
      failureDescription={failureDescription}
      failureHint={failureHint}
      isMutedFailure={isMutedFailure}
      steps={isComplete || isFailure ? undefined : buildSteps(flow, direction)}
      isCancellable={isCancellable}
      isCancelling={isCancelling}
      cancelError={cancelError?.message}
      onCancel={() => cancelFlowMutate({ flowId })}
      details={{
        executionLabel: EXECUTION_LABELS[flow.executionState],
        settlementLabel: SETTLEMENT_LABELS[flow.settlementState],
        screeningLabel: RISK_LABELS[flow.riskState],
        quoteLabel: flow.quote
          ? `${flow.quote.fromAmount} → ${flow.quote.toAmount}${
              flow.quote.fees?.totalFeeUsd
                ? ` (~$${flow.quote.fees.totalFeeUsd} fee)`
                : ''
            }`
          : undefined,
        flowId: flow.id,
        sourceTxHash: flow.txHash ?? undefined,
        destinationTxHash: flow.settlementTxHash ?? undefined,
      }}
      onDone={onDone}
    />
  );
}
