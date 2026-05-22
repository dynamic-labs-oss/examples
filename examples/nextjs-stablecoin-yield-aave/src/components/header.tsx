"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import DynamicLogo from "./dynamic/logo";

const DynamicButton = dynamic(() => import("./dynamic/dynamic-button"), { ssr: false });

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#DADADA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <DynamicLogo className="text-[#141839]" />
          </Link>
        </div>
        <DynamicButton />
      </div>
    </header>
  );
}
