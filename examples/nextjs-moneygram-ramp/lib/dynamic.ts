import { createClient } from "@dynamic-labs/client";
import { DynamicWaasEVMConnectors } from "@dynamic-labs/waas-evm";
import { DynamicWaasSVMConnectors } from "@dynamic-labs/waas-svm";
import { env } from "./env";

export const dynamicClient = createClient({
  environmentId: env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
  appName: "MoneyGram Ramp Demo",
})
  .extend(DynamicWaasEVMConnectors())
  .extend(DynamicWaasSVMConnectors());
