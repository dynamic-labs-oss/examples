import Link from "next/link";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import DynamicLogo from "./dynamic/logo";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-earn-border shadow-[0_1px_2px_0_rgba(0,0,0,0.1)] z-40 flex items-center px-4">
      <div className="flex items-center">
        <Link href="/">
          <DynamicLogo className="text-[#141839]" />
        </Link>
      </div>
      <div className="ml-auto">
        <DynamicWidget />
      </div>
    </header>
  );
}
