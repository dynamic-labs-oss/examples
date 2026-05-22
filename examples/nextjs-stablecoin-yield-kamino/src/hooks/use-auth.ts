"use client";

import { useEffect } from "react";
import { useUser } from "@dynamic-labs-sdk/react-hooks";
import { initDynamic } from "@/lib/dynamic";

export function useAuth(): boolean {
  useEffect(() => {
    void initDynamic();
  }, []);
  return useUser() !== null;
}
