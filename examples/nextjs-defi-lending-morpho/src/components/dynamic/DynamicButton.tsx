"use client";

import {
  DynamicConnectButton,
  useDynamicContext,
  useIsLoggedIn,
} from "@dynamic-labs/sdk-react-core";
import { Button } from "../ui/button";

export default function DynamicButton() {
  const isLoggedIn = useIsLoggedIn();
  const { setShowDynamicUserProfile } = useDynamicContext();

  if (isLoggedIn) {
    return (
      <Button
        className="w-full"
        onClick={() => setShowDynamicUserProfile(true)}
      >
        View Profile
      </Button>
    );
  }
  return (
    <DynamicConnectButton buttonClassName="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 rounded-md px-3 w-full">
      Log in or sign up
    </DynamicConnectButton>
  );
}
