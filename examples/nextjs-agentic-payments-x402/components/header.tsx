import Link from "next/link";

import DynamicLogo from "./dynamic/logo";
import LogoutButton from "./dynamic/logout-button";

export default function Header() {
  return (
    <div className="absolute top-0 flex items-center justify-between w-full py-2">
      <div className="pl-4 h-[40px] flex items-center">
        <Link href="/">
          <DynamicLogo />
        </Link>
      </div>
      <div className="flex gap-2 pr-4 items-center">
        <LogoutButton />
      </div>
    </div>
  );
}
