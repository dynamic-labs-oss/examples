import { createClient } from "@dynamic-labs/client";
import { DynamicWaasEVMConnectors } from "@dynamic-labs/waas-evm";

export const dynamicClient = createClient({
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  appName: "Mayan Bridge",
}).extend(DynamicWaasEVMConnectors());
