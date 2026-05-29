import Link from "next/link";
import DynamicButton from "./dynamic-button";
import DynamicLogo from "./dynamic-logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-16 w-full px-4 bg-white border-b border-[#DADADA]">
      <Link href="/">
        <DynamicLogo />
      </Link>
      <DynamicButton />
    </header>
  );
}
