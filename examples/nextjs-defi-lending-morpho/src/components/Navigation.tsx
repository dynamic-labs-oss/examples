"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import DynamicLogo from "./dynamic/Logo";

export default function Navigation() {
  const currentPath = usePathname();

  const isActive = (path: string) =>
    currentPath === path || currentPath.startsWith(`${path}/`);

  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 bg-white z-40 flex items-center px-6 gap-4"
      style={{ borderBottom: "1px solid #DADADA", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.08)" }}
    >
      <Link href="/" className="flex items-center">
        <DynamicLogo width={120} height={24} className="text-[#030303]" />
      </Link>

      <nav className="flex items-center gap-1 ml-2">
        <Link
          href="/earn"
          className="px-3 py-1.5 rounded-md text-sm transition-colors"
          style={
            isActive("/earn")
              ? { background: "#E8F0FE", color: "#1967D2", fontWeight: 500 }
              : { color: "#606060" }
          }
        >
          Earn
        </Link>
        <Link
          href="/borrow"
          className="px-3 py-1.5 rounded-md text-sm transition-colors"
          style={
            isActive("/borrow")
              ? { background: "#E8F0FE", color: "#1967D2", fontWeight: 500 }
              : { color: "#606060" }
          }
        >
          Borrow
        </Link>
      </nav>

      <div className="ml-auto">
        <DynamicWidget />
      </div>
    </header>
  );
}
