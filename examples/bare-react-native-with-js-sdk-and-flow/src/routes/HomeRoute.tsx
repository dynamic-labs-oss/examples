/**
 * Home screen: just the two entry points, Deposit and Withdraw. No account
 * model in this app anymore — no login, no vault, nothing to own or poll
 * here, so this is a thin pass-through with no hooks of its own.
 */
import { HomeView } from '../views/HomeView';
import type { RouteProps } from '../navigation';

export function HomeRoute({ navigation }: RouteProps<'Home'>) {
  return (
    <HomeView
      onDeposit={() => navigation.navigate('Deposit')}
      onWithdraw={() => navigation.navigate('Withdraw')}
    />
  );
}
