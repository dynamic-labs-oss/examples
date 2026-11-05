import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg shadow-sm border border-[#DADADA] bg-white p-6">
      <h2 className="text-lg font-semibold text-[#030303]">{title}</h2>
      {subtitle && <p className="text-sm text-[#606060] mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
