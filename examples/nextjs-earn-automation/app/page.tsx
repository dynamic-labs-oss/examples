import EarnAutomation from "@/components/earn-automation";
import Portfolio from "@/components/portfolio";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-medium text-earn-text-primary">Earn</h1>
        <p className="mt-1 text-sm text-earn-text-secondary">
          See your wallet and vault positions, deposit or withdraw any time, and
          optionally delegate once to auto-deposit on a schedule.
        </p>
      </header>
      <Portfolio />
      <EarnAutomation />
    </main>
  );
}
