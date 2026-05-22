"use client";

import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { dynamicClient } from "@/lib/dynamic";

export function useAuth(): boolean {
  const client = useReactiveClient(dynamicClient);
  return client.auth.authenticatedUser !== undefined;
}
