import "../polyfills";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { dynamicClient } from "@/lib/dynamic";

export default function RootLayout() {
  return (
    <>
      <dynamicClient.reactNative.WebView />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#030712" },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
