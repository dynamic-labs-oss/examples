"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import DynamicLogo from "./dynamic/logo";
import { Nav } from "./nav";

const DynamicButton = dynamic(() => import("./dynamic/dynamic-button"), {
  ssr: false,
});

export function Header() {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between h-16 px-6 bg-white"
      style={{ borderBottom: "1px solid #DADADA", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center shrink-0">
          <DynamicLogo width={120} height={24} className="text-[#030303]" />
        </Link>
        <div className="hidden md:block">
          <Nav />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <DynamicButton />
      </div>
    </header>
  );
}
