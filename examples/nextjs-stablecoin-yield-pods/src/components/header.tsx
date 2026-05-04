import Link from "next/link";
import DynamicButton from "./dynamic/dynamic-button";
import DynamicLogo from "./dynamic/logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#DADADA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <DynamicLogo />
          </Link>
        </div>
        <DynamicButton />
      </div>
    </header>
  );
}
