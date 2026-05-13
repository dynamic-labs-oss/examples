import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { HamburgerMenu } from "@/components/hamburger-menu";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import DynamicLogo from "./dynamic/logo";
import DynamicButton from "./dynamic/dynamic-button";

export function Header() {
  return (
    <div
      className={
        "absolute top-0 flex items-center justify-between w-full py-2 sticky bg-background/80 backdrop-blur-md border-b border-border z-50"
      }
    >
      <div className="pl-4 h-[40px] flex items-center">
        <Link href="/">
          <DynamicLogo />
        </Link>
      </div>
      <div className="hidden md:flex gap-2 pr-4">
        <DynamicWidget />
        <ModeToggle />
      </div>
      <div className="md:hidden pr-4">
        <HamburgerMenu>
          <DynamicButton />
        </HamburgerMenu>
      </div>
    </div>
  );
}
