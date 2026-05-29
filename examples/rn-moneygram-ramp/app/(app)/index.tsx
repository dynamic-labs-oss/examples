import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { dynamicClient } from "@/lib/dynamic";
import { fetchUsdcBalance } from "@/lib/balance";
import { MoneygramWidget } from "@/components/MoneygramWidget";
import {
  type SolanaChainId,
  SOL_CHAIN_IDS,
  NETWORK_LABEL,
  USDC_MINT_BY_CHAIN,
} from "@/lib/network";

function truncate(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function HomeScreen() {
  const client = useReactiveClient(dynamicClient);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [solanaChainId, setSolanaChainId] = useState<SolanaChainId>(SOL_CHAIN_IDS.devnet);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);

  const userWallets = client.wallets.userWallets ?? [];

  // Dynamic 4.x embedded wallets: Solana is "SOL"
  const solanaWallet = userWallets.find((w) => w.chain === "SOL") ?? null;

  const address = solanaWallet?.address ?? "";

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setBalance(null);
      return;
    }
    setLoadingBalance(true);
    try {
      const bal = await fetchUsdcBalance(address, USDC_MINT_BY_CHAIN[solanaChainId]);
      setBalance(bal);
    } finally {
      setLoadingBalance(false);
    }
  }, [address, solanaChainId]);

  useEffect(() => {
    if (!solanaWallet) return;
    dynamicClient.wallets
      .getNetwork({ wallet: solanaWallet })
      .then(({ network }) => {
        const id = String(network) as SolanaChainId;
        if (id === SOL_CHAIN_IDS.mainnet || id === SOL_CHAIN_IDS.devnet) {
          setSolanaChainId(id);
        }
      })
      .catch(() => {});
  }, [solanaWallet]);

  const handleSwitchSolanaNetwork = useCallback(async () => {
    if (!solanaWallet || switchingNetwork) return;
    const next = solanaChainId === SOL_CHAIN_IDS.mainnet
      ? SOL_CHAIN_IDS.devnet
      : SOL_CHAIN_IDS.mainnet;
    setSwitchingNetwork(true);
    try {
      await dynamicClient.wallets.switchNetwork({ wallet: solanaWallet, chainId: next });
      setSolanaChainId(next);
      refreshBalance();
    } catch (e) {
      console.error('[Network] Switch failed:', e);
    } finally {
      setSwitchingNetwork(false);
    }
  }, [solanaWallet, solanaChainId, switchingNetwork, refreshBalance]);

  useEffect(() => {
    setBalance(null);
    refreshBalance();
  }, [refreshBalance]);

  const handleCopy = () => {
    if (!address) return;
    Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSuccess = useCallback(
    (amount: string) => {
      const parsed = Number.parseFloat(amount);
      const label = parsed > 0 ? `$${parsed.toFixed(2)} USDC` : "Funds";
      Alert.alert("Success!", `${label} sent for cash pickup.`);
      refreshBalance();
    },
    [refreshBalance]
  );

  const canRamp = !!address && balance !== null && balance > 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Off-ramp USDC</Text>
          <Text style={styles.headerSub}>Convert to cash worldwide</Text>
        </View>
        <View style={styles.headerRight}>
          {solanaWallet && (
            <TouchableOpacity
              onPress={handleSwitchSolanaNetwork}
              disabled={switchingNetwork}
              style={[
                styles.networkBadge,
                solanaChainId === SOL_CHAIN_IDS.mainnet
                  ? styles.networkBadgeMainnet
                  : styles.networkBadgeDevnet,
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.networkBadgeText,
                solanaChainId === SOL_CHAIN_IDS.mainnet
                  ? styles.networkBadgeTextMainnet
                  : styles.networkBadgeTextDevnet,
              ]}>
                {switchingNetwork ? "…" : NETWORK_LABEL[solanaChainId]}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
        {/* Wallet + Balance card */}
        <View style={styles.card}>
          <Text style={styles.label}>Solana wallet address</Text>
          <View style={styles.addressRow}>
            <Text style={[styles.addressText, !address && styles.dimText]}>
              {address ? truncate(address) : "No wallet connected"}
            </Text>
            {!!address && (
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
              Your Solana wallet is still initialising…
            </Text>
          )}
          {!!address && balance === 0 && !loadingBalance && (
            <Text style={styles.hint}>
              Fund your wallet with USDC on Solana to get started.
            </Text>
          )}
        </View>

        {/* How it works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            {
              n: "1",
              t: "Sign in",
              d: "Authenticate with email — a Solana embedded wallet is created automatically.",
            },
            {
              n: "2",
              t: "Fund with USDC",
              d: "Send USDC on Solana to your wallet address above.",
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
        walletAddress={address}
        usdcBalance={balance ?? 0}
        usdcMint={USDC_MINT_BY_CHAIN[solanaChainId]}
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  networkBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  networkBadgeDevnet: {
    backgroundColor: "rgba(234,179,8,0.1)",
    borderColor: "rgba(234,179,8,0.35)",
  },
  networkBadgeMainnet: {
    backgroundColor: "rgba(34,197,94,0.1)",
    borderColor: "rgba(34,197,94,0.35)",
  },
  networkBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  networkBadgeTextDevnet:  { color: "#eab308" },
  networkBadgeTextMainnet: { color: "#22c55e" },
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
