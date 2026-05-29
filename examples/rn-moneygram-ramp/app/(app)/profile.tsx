import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { dynamicClient } from "@/lib/dynamic";

function truncate(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ProfileScreen() {
  const client = useReactiveClient(dynamicClient);
  const [copied, setCopied] = useState(false);

  const user = client.auth.authenticatedUser;
  const email = user?.email ?? "—";

  const userWallets = client.wallets.userWallets ?? [];
  const solanaWallet = userWallets.find((w) => w.chain === "SOL") ?? null;
  const address = solanaWallet?.address ?? "";

  const handleCopy = () => {
    if (!address) return;
    Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => dynamicClient.auth.logout(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{email}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>Solana wallet address</Text>
          <View style={styles.addressRow}>
            <Text style={[styles.address, !address && styles.dimText]}>
              {address ? truncate(address) : "No wallet connected"}
            </Text>
            {!!address && (
              <TouchableOpacity
                onPress={handleCopy}
                activeOpacity={0.7}
                style={styles.copyBtn}
              >
                <Text style={styles.copyBtnText}>
                  {copied ? "✓ Copied" : "Copy"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          style={styles.signOutBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#030712" },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f9fafb" },
  content: { padding: 20, gap: 16 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  label: {
    fontSize: 11,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  value: { fontSize: 15, color: "#f9fafb", fontWeight: "500" },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 8,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  address: {
    fontSize: 15,
    fontFamily: "monospace",
    color: "#f9fafb",
    fontWeight: "500",
  },
  dimText: { color: "#9ca3af" },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(20,184,166,0.12)",
    borderWidth: 1,
    borderColor: "rgba(20,184,166,0.3)",
  },
  copyBtnText: { fontSize: 12, color: "#14b8a6", fontWeight: "600" },
  signOutBtn: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  signOutText: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
});
