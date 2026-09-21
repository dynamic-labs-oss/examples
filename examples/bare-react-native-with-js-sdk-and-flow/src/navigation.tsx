/**
 * Owns the app's screen-to-screen navigation via React Navigation's
 * native-stack. Every screen renders its own Header (see
 * components/Header.tsx) instead of native-stack's built-in one, hence
 * `headerShown: false` below.
 *
 * There's no account model in this app — no login, no vault — so there's
 * nothing to check before picking an initial screen beyond the Dynamic
 * client itself finishing initialization. Until `useInitStatus()` reports
 * `'finished'`, SplashView is rendered directly (not as a registered
 * screen — there's nothing to navigate to yet).
 */
import { useInitStatus } from '@dynamic-labs-sdk/react-hooks';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { SplashView } from './views/SplashView';
import { HomeRoute } from './routes/HomeRoute';
import { DepositRoute } from './routes/DepositRoute';
import { FlowStatusRoute } from './routes/FlowStatusRoute';
import { WithdrawRoute } from './routes/WithdrawRoute';

export type RootStackParamList = {
  Home: undefined;
  Deposit: undefined;
  Withdraw: undefined;
  FlowStatus: { flowId: string; direction: 'deposit' | 'withdraw' };
};

export type RouteProps<Name extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Name>;

const Stack = createNativeStackNavigator<RootStackParamList>();

export function Navigation() {
  const { data: initStatus, error: initError } = useInitStatus();

  // A distinct, unrecoverable-from-here state, checked before the loading
  // check below — without this, a failed init (bad/unreachable environment
  // config, offline cold boot) leaves the app stuck on the loading spinner
  // indefinitely, since nothing else ever flips `initStatus` away from
  // 'failed'.
  if (initStatus === 'failed') {
    return (
      <SplashView
        error={initError?.message ?? 'Something went wrong starting the app.'}
      />
    );
  }

  if (initStatus !== 'finished') {
    return <SplashView message="Starting…" />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Home" component={HomeRoute} />
        <Stack.Screen name="Deposit" component={DepositRoute} />
        <Stack.Screen name="Withdraw" component={WithdrawRoute} />
        <Stack.Screen name="FlowStatus" component={FlowStatusRoute} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
