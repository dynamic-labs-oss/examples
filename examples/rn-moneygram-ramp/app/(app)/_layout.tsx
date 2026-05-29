import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { dynamicClient } from "@/lib/dynamic";

export default function AppLayout() {
  const client = useReactiveClient(dynamicClient);
  const isAuthenticated = !!client.auth.authenticatedUser;

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#14b8a6",
        tabBarInactiveTintColor: "#6b7280",
        sceneStyle: { backgroundColor: "#030712" },
        tabBarStyle: {
          backgroundColor: "#0b1120",
          borderTopColor: "rgba(255,255,255,0.08)",
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
