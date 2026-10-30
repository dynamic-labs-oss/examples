import EarnAutomation from "@/components/earn-automation";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-6">
      <header className="pt-8">
        <h1 className="text-2xl font-semibold">Earn automation</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Delegate once, then auto-deposit your wallet&apos;s assets into a
          yield vault — everything, or a fixed amount per run.
        </p>
      </header>
      <EarnAutomation />
    </main>
  );
}
