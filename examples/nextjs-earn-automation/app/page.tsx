import EarnAutomation from "@/components/earn-automation";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-medium text-earn-text-primary">
          Earn automation
        </h1>
        <p className="mt-1 text-sm text-earn-text-secondary">
          Delegate once, then auto-deposit your wallet&apos;s assets into a
          yield vault — everything, or a fixed amount per run.
        </p>
      </header>
      <EarnAutomation />
    </main>
  );
}
