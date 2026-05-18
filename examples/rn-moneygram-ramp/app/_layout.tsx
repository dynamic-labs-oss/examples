import "../polyfills";
import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { dynamicClient } from "@/lib/dynamic";

export default function RootLayout() {
  const client = useReactiveClient(dynamicClient);
  const router = useRouter();
  const segments = useSegments();
  const initialMount = useRef(true);

  const isAuthenticated = !!client.auth.authenticatedUser;

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    const inApp = segments[0] === "(app)";
    if (isAuthenticated && !inApp) router.replace("/(app)");
    else if (!isAuthenticated && inApp) router.replace("/login");
  }, [isAuthenticated]);

  return (
    <>
      <dynamicClient.reactNative.WebView />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0f1117" },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
