import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { Redirect, Stack } from "expo-router";
import { dynamicClient } from "@/lib/dynamic";

export default function AppLayout() {
  const client = useReactiveClient(dynamicClient);
  const isAuthenticated = !!client.auth.authenticatedUser;

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#030712" },
      }}
    />
  );
}
