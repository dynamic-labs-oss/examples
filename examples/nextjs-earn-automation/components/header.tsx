"use client";

import { useEffect, useState } from "react";
import { useLogout, useUser } from "@dynamic-labs-sdk/react-hooks";
import DynamicLogo from "@/components/dynamic/logo";

export default function Header() {
  const { data: user } = useUser();
  const { mutate: logout, isPending } = useLogout();
  // The session lives only in the browser, so the server always renders the
  // signed-out header. Render the user block after mount to avoid a hydration
  // mismatch when a stored session is restored on the first client render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-40 border-b border-earn-border bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <DynamicLogo className="text-[#141839]" />
        {mounted && user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-earn-text-secondary">{user.email}</span>
            <button
              onClick={() => logout()}
              disabled={isPending}
              className="rounded-lg border border-earn-border px-3 py-1.5 hover:bg-earn-light disabled:opacity-50"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
