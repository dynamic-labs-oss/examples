import Link from "next/link";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import DynamicLogo from "./dynamic/logo";
import { HamburgerMenu } from "./hamburger-menu";
import DynamicButton from "./dynamic/dynamic-button";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-16 px-6 bg-background border-b">
      <Link href="/" className="flex items-center">
        <DynamicLogo width={120} height={24} />
      </Link>

      <div className="hidden md:flex gap-2 pr-4">
        <DynamicWidget />
      </div>
      <div className="md:hidden pr-4">
        <HamburgerMenu>
          <DynamicButton />
        </HamburgerMenu>
      </div>
    </header>
  );
}
