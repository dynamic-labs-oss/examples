import { createClient } from "@dynamic-labs/client";
import { ReactNativeExtension } from "@dynamic-labs/react-native-extension";
import { ViemExtension } from "@dynamic-labs/viem-extension";

const environmentId = process.env.EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID as string;

export const dynamicClient = createClient({
  environmentId,
  appName: "MoneyGram Ramp",
  appOrigin: "http://localhost:8081",
})
  .extend(ReactNativeExtension())
  .extend(ViemExtension());
