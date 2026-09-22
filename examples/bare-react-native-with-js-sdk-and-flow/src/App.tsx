import { DynamicProvider } from '@dynamic-labs-sdk/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dynamicClient } from '../dynamicClient';
import { colors } from './consts/theme';
import { ConnectedWalletProvider } from './state/connectedWallet';
import { Navigation } from './navigation';

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <DynamicProvider client={dynamicClient}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.pageBackground}
          />
          <ConnectedWalletProvider>
            <Navigation />
          </ConnectedWalletProvider>
        </DynamicProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
