import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { dynamicClient } from "@/lib/dynamic";
import { MoneygramWidget } from "@/components/MoneygramWidget";
import { type MgiRecord, loadAllRecords } from "@/lib/moneygram";

function formatDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryScreen() {
  const client = useReactiveClient(dynamicClient);

  const [records, setRecords] = useState<MgiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  const userWallets = client.wallets.userWallets ?? [];
  const solanaWallet = userWallets.find((w) => w.chain === "SOL") ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await loadAllRecords());
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the screen regains focus — a new off-ramp may have completed.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const renderItem = useCallback(
    ({ item }: { item: MgiRecord }) => {
      const amount = Number.parseFloat(item.amount);
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => setViewId(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.rowTop}>
            <View>
              <Text style={styles.amount}>
                {amount > 0 ? `$${amount.toFixed(2)}` : "—"} USDC
              </Text>
              <Text style={styles.subtitle}>Cash Pickup</Text>
            </View>
            <Text style={styles.viewLink}>View live status →</Text>
          </View>
          {!!item.referenceNumber && (
            <Text style={styles.ref}>Ref: {item.referenceNumber}</Text>
          )}
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </TouchableOpacity>
      );
    },
    []
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
      </View>

      <FlatList
        data={records}
        keyExtractor={(r) => `${r.id}-${r.createdAt}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor="#14b8a6"
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyDesc}>
                Completed cash pickups will appear here. Tap one to view its
                live status or request a refund.
              </Text>
            </View>
          ) : null
        }
      />

      {/* View mode — reopen the selected transaction for status + refunds */}
      <MoneygramWidget
        open={!!viewId}
        walletAddress={solanaWallet?.address ?? ""}
        usdcBalance={0}
        viewTransactionId={viewId ?? undefined}
        onClose={() => {
          setViewId(null);
          refresh();
        }}
      />
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
  list: { padding: 16, gap: 12, flexGrow: 1 },
  row: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  amount: { fontSize: 17, fontWeight: "700", color: "#f9fafb" },
  subtitle: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  ref: { fontSize: 13, color: "#9ca3af", fontFamily: "monospace" },
  date: { fontSize: 12, color: "#6b7280" },
  viewLink: { fontSize: 13, color: "#14b8a6", fontWeight: "600" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#f9fafb" },
  emptyDesc: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
  },
});
