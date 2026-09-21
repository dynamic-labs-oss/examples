/**
 * Dumb, prop-driven port of FlowStatusScreen.tsx's presentational half — the
 * step list, risk banner, complete/failure summaries, and collapsible
 * technical-details block, with every place that used to read `flow`
 * directly (or react-query's isPending/isError/error/isCancelling/
 * cancelError) now reading the equivalent value from props instead. The
 * route/widget that renders this owns useGetFlow/useCancelFlow and all the
 * derived-state computation (buildSteps, isFailure/isComplete resolution,
 * the failure title/description/hint strings, the technical-details label
 * strings) — this view has no @dynamic-labs-sdk/react-hooks or react-query
 * import at all, only a type-only import of FlowRiskState for prop typing.
 *
 * `showDetails` is the one exception to "props are the only state": it's
 * pure UI toggle state with no bearing on any business logic, so — exactly
 * like the original FlowStatusScreen.tsx — it stays a local useState here
 * rather than being lifted to the caller.
 *
 * Branch order mirrors the original exactly: isLoading -> loadError (full
 * takeover, only when there's truly nothing cached) -> isFailure -> isComplete
 * -> otherwise (in-progress step list). See FlowStatusScreen.tsx's top-of-file
 * comment for why isFailure is resolved before isComplete, and why the
 * loadError takeover is gated on "nothing to show" rather than plain isError.
 */
import type { FlowRiskState } from '@dynamic-labs-sdk/client';
import Clipboard from '@react-native-clipboard/clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CopyButton } from '../components/CopyButton';
import { ErrorText } from '../components/ErrorText';
import { Header } from '../components/Header';
import { AlertCircleIcon, CheckCircleIcon } from '../components/icons';
import { LinkButton } from '../components/LinkButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SecondaryButton } from '../components/SecondaryButton';
import { colors, radii, spacing, typography } from '../consts/theme';

export type StepStatus = 'completed' | 'active' | 'pending';

export type Step = {
  key: string;
  title: string;
  description: string;
  status: StepStatus;
};

export type Details = {
  executionLabel: string;
  settlementLabel: string;
  screeningLabel: string;
  quoteLabel?: string;
  flowId: string;
  sourceTxHash?: string;
  destinationTxHash?: string;
};

type Props = {
  direction: 'deposit' | 'withdraw';
  /** Mirrors FlowStatusScreen.tsx's `isPending` (react-query's initial-load
   * state, not a mutation's). */
  isLoading: boolean;
  /** Set ONLY when there's truly nothing cached to show (mirrors
   * FlowStatusScreen.tsx's `isError && !flow` branch) — the full-page error
   * takeover. */
  loadError?: string;
  onRetryLoad: () => void;
  onGiveUp: () => void;

  // The rest are present once loaded (isLoading === false && !loadError):
  riskState?: FlowRiskState;
  /** Mirrors the `isError` (but WITH a cached flow present) inline "stale"
   * notice. */
  isStale?: boolean;
  isComplete?: boolean;
  isFailure?: boolean;
  failureTitle?: string;
  failureDescription?: string;
  failureHint?: string;
  isMutedFailure?: boolean;
  /** Only meaningful when !isComplete && !isFailure — the in-progress step
   * list. */
  steps?: Step[];
  isCancellable?: boolean;
  isCancelling?: boolean;
  cancelError?: string;
  onCancel?: () => void;
  details?: Details;
  onDone: () => void;
};

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return <CheckCircleIcon size={24} color={colors.success} />;
  }
  if (status === 'active') {
    return (
      <View style={styles.activeIconWrap}>
        <ActivityIndicator size="small" color={colors.warning} />
      </View>
    );
  }
  return <View style={styles.pendingDot} />;
}

function StepRow({ step, isLast }: { step: Step; isLast: boolean }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIconColumn}>
        <StepIcon status={step.status} />
        {!isLast ? (
          <View
            style={[
              styles.stepConnector,
              step.status === 'completed' && styles.stepConnectorActive,
            ]}
          />
        ) : null}
      </View>
      <View style={styles.stepTextColumn}>
        <Text
          style={[
            styles.stepTitle,
            step.status === 'pending' && styles.stepTitleMuted,
          ]}
        >
          {step.title}
        </Text>
        <Text style={styles.stepDescription}>{step.description}</Text>
      </View>
    </View>
  );
}

function RiskBanner({ riskState }: { riskState?: FlowRiskState }) {
  if (riskState !== 'blocked' && riskState !== 'review') {
    return null;
  }
  const isBlocked = riskState === 'blocked';
  return (
    <View
      style={[
        styles.riskBanner,
        isBlocked ? styles.riskBannerBlocked : styles.riskBannerReview,
      ]}
    >
      <Text style={styles.riskBannerText}>
        {isBlocked
          ? 'This transfer was blocked during compliance screening. Contact support for help.'
          : 'This transfer is under manual compliance review — this can take longer than usual.'}
      </Text>
    </View>
  );
}

/** Small "Copy" button with transient "Copied!" feedback. */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [justCopied, setJustCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.copyRow}>
      <View style={styles.copyRowText}>
        <Text style={styles.copyRowLabel}>{label}</Text>
        <Text style={styles.copyRowValue} numberOfLines={1}>
          {value.length > 20 ? shortHash(value) : value}
        </Text>
      </View>
      <CopyButton
        title={justCopied ? 'Copied!' : 'Copy'}
        onPress={() => {
          Clipboard.setString(value);
          setJustCopied(true);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => setJustCopied(false), 1500);
        }}
      />
    </View>
  );
}

function TechnicalDetails({ details }: { details: Details }) {
  return (
    <View style={styles.detailsBlock}>
      <View style={styles.divider} />
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Execution</Text>
        <Text style={styles.detailValue}>{details.executionLabel}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Settlement</Text>
        <Text style={styles.detailValue}>{details.settlementLabel}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Screening</Text>
        <Text style={styles.detailValue}>{details.screeningLabel}</Text>
      </View>
      {details.quoteLabel ? (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Quote</Text>
          <Text style={styles.detailValue}>{details.quoteLabel}</Text>
        </View>
      ) : null}

      <CopyRow label="Flow ID" value={details.flowId} />
      {details.sourceTxHash ? (
        <CopyRow
          label="Source transaction hash (Base)"
          value={details.sourceTxHash}
        />
      ) : null}
      {details.destinationTxHash ? (
        <CopyRow
          label="Destination transaction hash"
          value={details.destinationTxHash}
        />
      ) : null}
    </View>
  );
}

function DetailsToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.detailsToggleRow}>
      <LinkButton
        title={expanded ? 'Hide technical details' : 'Show technical details'}
        onPress={onToggle}
      />
    </View>
  );
}

function CompleteSummary({
  direction,
  onDone,
}: {
  direction: 'deposit' | 'withdraw';
  onDone: () => void;
}) {
  const noun = direction === 'deposit' ? 'Deposit' : 'Withdrawal';
  return (
    <View style={styles.summaryCentered}>
      <CheckCircleIcon size={56} color={colors.success} />
      <Text style={styles.summaryTitle}>{`${noun} complete`}</Text>
      <Text style={styles.summaryDescription}>
        {direction === 'deposit'
          ? 'USDC has landed at the destination address.'
          : 'ETH has landed at the destination address.'}
      </Text>
      <PrimaryButton
        title="Back to Home"
        style={styles.summaryButton}
        onPress={onDone}
      />
    </View>
  );
}

function FailureSummary({
  title,
  description,
  hint,
  isMuted,
  onDone,
}: {
  title: string;
  description: string;
  hint?: string;
  isMuted: boolean;
  onDone: () => void;
}) {
  return (
    <View style={styles.summaryCentered}>
      <AlertCircleIcon
        size={56}
        color={isMuted ? colors.foregroundSecondary : colors.error}
      />
      <Text style={[styles.summaryTitle, isMuted && styles.summaryTitleMuted]}>
        {title}
      </Text>
      <Text style={styles.summaryDescription}>{description}</Text>
      {!isMuted && hint ? <Text style={styles.summaryHint}>{hint}</Text> : null}
      <PrimaryButton
        title="Back to Home"
        style={styles.summaryButton}
        onPress={onDone}
      />
    </View>
  );
}

export function FlowStatusView({
  direction,
  isLoading,
  loadError,
  onRetryLoad,
  onGiveUp,
  riskState,
  isStale,
  isComplete,
  isFailure,
  failureTitle,
  failureDescription,
  failureHint,
  isMutedFailure,
  steps,
  isCancellable,
  isCancelling,
  cancelError,
  onCancel,
  details,
  onDone,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const noun = direction === 'deposit' ? 'Deposit' : 'Withdrawal';

  // No onBack on any branch below: mid-flight this isn't cancelable via a
  // header back button (matches the original's behavior of no navigation
  // away at all while in-progress) — the in-progress branch's own Cancel
  // link and the terminal branches' "Back to Home" button are the only
  // ways off this screen, same as before this Header existed.
  const headerTitle = `${noun} status`;

  if (isLoading) {
    return (
      <Screen>
        <Header title={headerTitle} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.hint}>Loading {noun.toLowerCase()} status…</Text>
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <Header title={headerTitle} />
        <Text style={styles.errorTitle}>Couldn't load status</Text>
        <ErrorText style={styles.errorTextSpaced}>{loadError}</ErrorText>
        <PrimaryButton title="Retry" onPress={onRetryLoad} />
        <SecondaryButton
          title="Give up and return home"
          style={styles.doneButton}
          onPress={onGiveUp}
        />
      </Screen>
    );
  }

  if (isFailure) {
    return (
      <Screen>
        <Header title={headerTitle} />
        <RiskBanner riskState={riskState} />
        <FailureSummary
          title={failureTitle ?? `${noun} failed`}
          description={
            failureDescription ??
            `Something went wrong processing this ${noun.toLowerCase()}.`
          }
          hint={failureHint}
          isMuted={Boolean(isMutedFailure)}
          onDone={onDone}
        />
        <DetailsToggle
          expanded={showDetails}
          onToggle={() => setShowDetails(v => !v)}
        />
        {showDetails && details ? <TechnicalDetails details={details} /> : null}
      </Screen>
    );
  }

  if (isComplete) {
    return (
      <Screen>
        <Header title={headerTitle} />
        <RiskBanner riskState={riskState} />
        <CompleteSummary direction={direction} onDone={onDone} />
        <DetailsToggle
          expanded={showDetails}
          onToggle={() => setShowDetails(v => !v)}
        />
        {showDetails && details ? <TechnicalDetails details={details} /> : null}
      </Screen>
    );
  }

  const inProgressSteps = steps ?? [];

  return (
    <Screen>
      <Header title={headerTitle} />
      <RiskBanner riskState={riskState} />
      {isStale ? (
        <View style={styles.staleNotice}>
          <Text style={styles.staleNoticeText}>
            Couldn't refresh the latest status — showing the last known state.
          </Text>
        </View>
      ) : null}
      <Text style={styles.title}>{`${noun} in progress`}</Text>

      <View style={styles.stepsBlock}>
        {inProgressSteps.map((step, index) => (
          <StepRow
            key={step.key}
            step={step}
            isLast={index === inProgressSteps.length - 1}
          />
        ))}
      </View>

      {isCancellable ? (
        <View style={styles.cancelRow}>
          {cancelError ? (
            <ErrorText style={styles.errorTextSpaced}>{cancelError}</ErrorText>
          ) : null}
          <LinkButton
            title={
              isCancelling ? 'Cancelling…' : `Cancel ${noun.toLowerCase()}`
            }
            tone="danger"
            disabled={isCancelling}
            onPress={() => onCancel?.()}
          />
        </View>
      ) : null}

      <DetailsToggle
        expanded={showDetails}
        onToggle={() => setShowDetails(v => !v)}
      />
      {showDetails && details ? <TechnicalDetails details={details} /> : null}

      <Text style={styles.hint}>
        This updates automatically every few seconds — you can leave and come
        back to this app while it's in progress.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  stepsBlock: {
    marginBottom: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepIconColumn: {
    width: 24,
    alignItems: 'center',
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginTop: spacing.xs,
    backgroundColor: colors.border,
  },
  stepConnectorActive: {
    backgroundColor: colors.success,
  },
  activeIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDot: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
    marginTop: 6,
    backgroundColor: colors.divider,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stepTextColumn: {
    flex: 1,
    marginLeft: spacing.md,
    paddingBottom: spacing.lg,
  },
  stepTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  stepTitleMuted: {
    color: colors.foregroundSecondary,
  },
  stepDescription: {
    fontSize: 13,
    color: colors.foregroundSecondary,
    marginTop: 2,
  },
  riskBanner: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  riskBannerBlocked: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: colors.error,
  },
  riskBannerReview: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: colors.warning,
  },
  riskBannerText: {
    ...typography.label,
    color: colors.foreground,
  },
  staleNotice: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.divider,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  staleNoticeText: {
    fontSize: 12,
    color: colors.foregroundSecondary,
  },
  cancelRow: {
    marginBottom: spacing.md,
  },
  detailsToggleRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailsBlock: {
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.foregroundSecondary,
  },
  detailValue: {
    ...typography.label,
    color: colors.foreground,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  copyRowText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  copyRowLabel: {
    fontSize: 12,
    color: colors.foregroundSecondary,
  },
  copyRowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  summaryCentered: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: spacing.md,
  },
  summaryTitleMuted: {
    color: colors.foregroundSecondary,
  },
  summaryDescription: {
    fontSize: 14,
    color: colors.foregroundSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  summaryHint: {
    fontSize: 12,
    color: colors.foregroundSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  summaryButton: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  hint: {
    fontSize: 12,
    color: colors.foregroundSecondary,
    lineHeight: 17,
    marginTop: spacing.md,
  },
  doneButton: {
    marginTop: spacing.md,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorTextSpaced: {
    marginBottom: spacing.md,
  },
});
