"use client";

import { useWallet } from "@/lib/providers";
import { Button } from "@/components/ui/button";

/**
 * Logout button for the header. Renders only when signed in. The JS SDK
 * restores the session asynchronously, so the first render is consistently
 * "signed out" on both server and client — no hydration mismatch.
 */
export default function LogoutButton() {
  const { loggedIn, disconnect } = useWallet();

  if (!loggedIn) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => disconnect()}
      className="text-red-600 hover:text-red-700 hover:bg-red-50"
    >
      Log Out
    </Button>
  );
}
