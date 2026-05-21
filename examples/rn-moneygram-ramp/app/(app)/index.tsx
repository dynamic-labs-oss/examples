import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Clipboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { dynamicClient } from "@/lib/dynamic";
import { CHAIN_ORDER, CHAINS, type Chain } from "@/lib/chains";
import { fetchUsdcBalance } from "@/lib/balance";
import { MoneygramWidget } from "@/components/MoneygramWidget";

function truncate(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function isEvmAddress(addr?: string) {
  return !!addr?.startsWith("0x");
}

export default function HomeScreen() {
  const client = useReactiveClient(dynamicClient);
  const [selectedChain, setSelectedChain] = useState<Chain>("base");
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const userWallets = client.wallets.userWallets ?? [];

  // Dynamic 4.x embedded wallets: EVM chain is "ETH", Solana is "SOL"
  const evmWallet =
    userWallets.find(
      (w) => w.chain === "ETH" || w.chain === "EVM" || isEvmAddress(w.address)
    ) ?? null;

  const solanaWallet =
    userWallets.find(
      (w) => w.chain === "SOL" || (!isEvmAddress(w.address) && (w.address?.length ?? 0) > 30)
    ) ?? null;

  const getAddress = useCallback((): string => {
    if (selectedChain === "solana") return solanaWallet?.address ?? "";
    return evmWallet?.address ?? "";
  }, [selectedChain, evmWallet, solanaWallet]);

  const address = getAddress();

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setBalance(null);
      return;
    }
    setLoadingBalance(true);
    try {
      const bal = await fetchUsdcBalance(selectedChain, address);
      setBalance(bal);
    } finally {
      setLoadingBalance(false);
    }
  }, [selectedChain, address]);

  useEffect(() => {
    setBalance(null);
    refreshBalance();
  }, [refreshBalance]);

  const handleCopy = () => {
    if (!address) return;
    Clipboard.setString(address);
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

  // MoneyGram Ramps is Solana-only — always use the Solana wallet + balance
  const solanaBalance = selectedChain === "solana" ? (balance ?? 0) : 0;

  const handleSuccess = useCallback(
    (amount: string) => {
      const parsed = parseFloat(amount);
      Alert.alert(
        "Success!",
        `${parsed > 0 ? `$${parsed.toFixed(2)} USDC` : "Funds"} sent for cash pickup.`
      );
      refreshBalance();
    },
    [refreshBalance]
  );

  const canRamp = !!solanaWallet?.address && balance !== null && balance > 0 && selectedChain === "solana";

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Off-ramp USDC</Text>
          <Text style={styles.headerSub}>Convert to cash worldwide</Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loadingBalance}
            onRefresh={refreshBalance}
            tintColor="#14b8a6"
          />
        }
      >
        {/* Chain selector */}
        <View style={styles.chainRow}>
          {CHAIN_ORDER.map((chain) => {
            const active = selectedChain === chain;
            return (
              <TouchableOpacity
                key={chain}
                onPress={() => setSelectedChain(chain)}
                style={[styles.chainBtn, active && styles.chainBtnActive]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chainBtnText,
                    active && styles.chainBtnTextActive,
                  ]}
                >
                  {CHAINS[chain].name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Wallet + Balance card */}
        <View style={styles.card}>
          <Text style={styles.label}>Wallet address</Text>
          <View style={styles.addressRow}>
            <Text style={[styles.addressText, !address && styles.dimText]}>
              {address ? truncate(address) : "No wallet connected"}
            </Text>
            {address && (
              <TouchableOpacity
                onPress={handleCopy}
                activeOpacity={0.7}
                style={styles.copyBtn}
              >
                <Text style={styles.copyBtnText}>{copied ? "✓ Copied" : "Copy"}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.label}>USDC Balance</Text>
          <Text style={styles.balanceText}>
            {loadingBalance || balance === null ? "—" : `$${balance.toFixed(2)}`}
          </Text>

          <TouchableOpacity
            style={[styles.rampBtn, !canRamp && styles.rampBtnDisabled]}
            onPress={() => setWidgetOpen(true)}
            disabled={!canRamp}
            activeOpacity={0.8}
          >
            <Text style={styles.rampBtnText}>Cash Pickup</Text>
          </TouchableOpacity>

          {!address && (
            <Text style={styles.hint}>
              Your {CHAINS[selectedChain].name} wallet is still initialising…
            </Text>
          )}
          {address && balance === 0 && !loadingBalance && (
            <Text style={styles.hint}>
              Fund your wallet with USDC on {CHAINS[selectedChain].name} to get
              started.
            </Text>
          )}
        </View>

        {/* Wallet addresses summary */}
        {(evmWallet?.address || solanaWallet?.address) && (
          <View style={styles.walletsCard}>
            <Text style={styles.walletsSectionTitle}>Your wallets</Text>
            {evmWallet?.address && (
              <View style={styles.walletRow}>
                <View style={[styles.chainDot, { backgroundColor: "#627EEA" }]} />
                <View style={styles.walletInfo}>
                  <Text style={styles.walletChainLabel}>EVM (Base / Ethereum)</Text>
                  <Text style={styles.walletAddress}>
                    {truncate(evmWallet.address)}
                  </Text>
                </View>
              </View>
            )}
            {solanaWallet?.address && (
              <View style={styles.walletRow}>
                <View style={[styles.chainDot, { backgroundColor: "#9945FF" }]} />
                <View style={styles.walletInfo}>
                  <Text style={styles.walletChainLabel}>Solana</Text>
                  <Text style={styles.walletAddress}>
                    {truncate(solanaWallet.address)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* How it works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            {
              n: "1",
              t: "Sign in",
              d: "Authenticate with email — embedded wallets on EVM and Solana are created automatically.",
            },
            {
              n: "2",
              t: "Choose your chain",
              d: "Select Base, Ethereum, or Solana — whichever holds your USDC.",
            },
            {
              n: "3",
              t: "Pick up cash",
              d: "Enter an amount and collect cash at a nearby MoneyGram location.",
            },
          ].map(({ n, t, d }) => (
            <View key={n} style={styles.howRow}>
              <View style={styles.howNum}>
                <Text style={styles.howNumText}>{n}</Text>
              </View>
              <View style={styles.howContent}>
                <Text style={styles.howStep}>{t}</Text>
                <Text style={styles.howDesc}>{d}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <MoneygramWidget
        open={widgetOpen}
        walletAddress={solanaWallet?.address ?? ""}
        usdcBalance={solanaBalance}
        onClose={() => setWidgetOpen(false)}
        onSuccess={handleSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#030712" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f9fafb" },
  headerSub: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  logoutText: { color: "#9ca3af", fontSize: 13, fontWeight: "500" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  chainRow: { flexDirection: "row", gap: 8 },
  chainBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  chainBtnActive: {
    backgroundColor: "rgba(20,184,166,0.12)",
    borderColor: "rgba(20,184,166,0.4)",
  },
  chainBtnText: { color: "#9ca3af", fontSize: 14, fontWeight: "600" },
  chainBtnTextActive: { color: "#14b8a6" },
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
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addressText: {
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
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 4,
  },
  balanceText: {
    fontSize: 38,
    fontWeight: "700",
    color: "#f9fafb",
    letterSpacing: -1,
  },
  rampBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  rampBtnDisabled: { opacity: 0.4 },
  rampBtnText: { color: "#030712", fontSize: 17, fontWeight: "700" },
  hint: { color: "#9ca3af", fontSize: 12, textAlign: "center", marginTop: 2 },
  walletsCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  walletsSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f9fafb",
    marginBottom: 4,
  },
  walletRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  chainDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  walletInfo: { flex: 1 },
  walletChainLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "600" },
  walletAddress: {
    fontSize: 14,
    fontFamily: "monospace",
    color: "#f9fafb",
    marginTop: 2,
  },
  howCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 16,
  },
  howTitle: { fontSize: 16, fontWeight: "700", color: "#f9fafb" },
  howRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  howNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20,184,166,0.12)",
    borderWidth: 1,
    borderColor: "rgba(20,184,166,0.3)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  howNumText: { color: "#14b8a6", fontSize: 12, fontWeight: "700" },
  howContent: { flex: 1, gap: 2 },
  howStep: { color: "#f9fafb", fontSize: 15, fontWeight: "600" },
  howDesc: { color: "#9ca3af", fontSize: 13, lineHeight: 20 },
});
