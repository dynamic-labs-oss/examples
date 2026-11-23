"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Subscribe" },
  { href: "/subscriptions", label: "My Subscriptions" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {navLinks.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-[#E8F0FE] text-[#1967D2]"
                : "text-[#606060] hover:text-[#030303] hover:bg-[#F9F9F9]"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
