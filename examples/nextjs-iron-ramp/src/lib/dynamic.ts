import { createClient } from "@dynamic-labs/client";
import { DynamicWaasEVMConnectors } from "@dynamic-labs/waas-evm";
import { DynamicWaasSVMConnectors } from "@dynamic-labs/waas-svm";

export const dynamicClient = createClient({
  environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
  appName: "Iron Finance Ramp",
})
  .extend(DynamicWaasEVMConnectors())
  .extend(DynamicWaasSVMConnectors());
