"use client";

interface SortFilterProps {
  sortBy: string;
  onSortChange: (sort: string) => void;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "volume", label: "Volume" },
  { value: "traders", label: "Traders" },
  { value: "price-diff", label: "Price Difference" },
] as const;

export function SortFilter({ sortBy, onSortChange }: SortFilterProps) {
  return (
    <div className="pt-[16px] flex items-center gap-3">
      <span className="font-medium text-[15px] text-[#606060]">
        Sort by:
      </span>
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="bg-white border border-[#DADADA] rounded-[27px] px-[12px] py-[6px] font-medium text-[15px] text-[#030303] focus:outline-none focus:border-[#4779FF] focus:ring-2 focus:ring-[#4779FF]/20 transition-colors duration-150"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
