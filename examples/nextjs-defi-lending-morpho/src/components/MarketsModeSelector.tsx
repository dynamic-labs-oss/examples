import React from "react";

interface MarketsModeSelectorProps {
  mode: "supply" | "withdraw" | "borrow" | "repay";
  onModeChange: (mode: "supply" | "withdraw" | "borrow" | "repay") => void;
}

export function MarketsModeSelector({
  mode,
  onModeChange,
}: MarketsModeSelectorProps) {
  const modes = [
    { key: "supply" as const, label: "Supply" },
    { key: "withdraw" as const, label: "Withdraw" },
    { key: "borrow" as const, label: "Borrow" },
    { key: "repay" as const, label: "Repay" },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 w-full">
      {modes.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onModeChange(key)}
          className={`rounded-lg py-2 cursor-pointer transition-colors duration-200 text-sm border ${
            mode === key
              ? "bg-earn-active-bg text-earn-active-text font-medium border-earn-primary/30"
              : "bg-earn-light text-earn-text-secondary border-earn-border hover:bg-gray-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
