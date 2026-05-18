import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0f1117" },
      }}
    />
  );
}
