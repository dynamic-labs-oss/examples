/**
 * Runs the connect screen and hands the result to whoever asked for it.
 * Deposit and Withdraw both send the user here rather than each driving
 * their own connection.
 */
import { useConnectWalletFlow } from '../hooks/useConnectWalletFlow';
import { useConnectedWallet } from '../state/connectedWallet';
import { ConnectWalletView } from '../views/ConnectWalletView';
import type { RouteProps } from '../navigation';

export function ConnectWalletRoute({
  navigation,
}: RouteProps<'ConnectWallet'>) {
  const { setConnectedWallet } = useConnectedWallet();

  const {
    catalogue,
    goBackToList,
    installWallet,
    isCatalogueLoading,
    openWalletAgain,
    selectChain,
    selectWallet,
    step,
    tryAgain,
    wallet,
  } = useConnectWalletFlow({
    onConnected: connectedWallet => {
      setConnectedWallet(connectedWallet);
      navigation.goBack();
    },
  });

  return (
    <ConnectWalletView
      step={step}
      walletOptions={catalogue ?? []}
      isLoadingWalletOptions={isCatalogueLoading}
      wallet={wallet}
      onSelectWallet={selectWallet}
      onSelectChain={selectChain}
      onTryAgain={tryAgain}
      onOpenWalletAgain={openWalletAgain}
      onInstallWallet={installWallet}
      // From the list there is nothing left to step back through, so Back
      // leaves the screen entirely.
      onBack={step === 'list' ? () => navigation.goBack() : goBackToList}
    />
  );
}
