import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { dynamicClient } from "@/lib/dynamic";

function GoogleIcon() {
  return (
    <View style={googleIconStyles.container}>
      <Text style={googleIconStyles.g}>G</Text>
    </View>
  );
}

const googleIconStyles = StyleSheet.create({
  container: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  g: { fontSize: 13, fontWeight: "700", color: "#4285F4" },
});

export default function LoginScreen() {
  const client = useReactiveClient(dynamicClient);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const hiddenRef = useRef<TextInput>(null);

  if (client.auth.authenticatedUser) {
    return <Redirect href="/(app)" />;
  }

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await dynamicClient.auth.social.connect({ provider: "google" });
    } catch {
      Alert.alert("Error", "Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await dynamicClient.auth.email.sendOTP(email.trim());
      setStep("otp");
    } catch {
      Alert.alert("Error", "Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (code: string) => {
    if (code.length !== 6) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      await dynamicClient.auth.email.verifyOTP(code);
    } catch {
      Alert.alert("Invalid Code", "Please check the code and try again.");
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
    if (digits.length === 6) setTimeout(() => handleVerifyOTP(digits), 80);
  };

  const otpArray = otp.split("").concat(Array(6 - otp.length).fill(""));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
        <Text style={styles.loadingText}>
          {step === "email" ? "Sending code…" : "Verifying…"}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.flex}>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.logoMark}>
                <Text style={styles.logoText}>MG</Text>
              </View>
              <Text style={styles.heroTitle}>MoneyGram{"\n"}Ramp</Text>
              <Text style={styles.heroSub}>
                Off-ramp USDC to cash{"\n"}at locations worldwide
              </Text>
            </View>

            {/* Auth card */}
            <View style={styles.card}>
              {step === "email" ? (
                <>
                  <Text style={styles.cardTitle}>Sign in</Text>
                  <Text style={styles.cardSub}>
                    Enter your email to continue
                  </Text>

                  {/* Google */}
                  <TouchableOpacity
                    style={styles.googleBtn}
                    onPress={handleGoogle}
                    activeOpacity={0.8}
                  >
                    <GoogleIcon />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </TouchableOpacity>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardAppearance="dark"
                    returnKeyType="go"
                    onSubmitEditing={handleSendOTP}
                  />
                  <TouchableOpacity
                    style={[styles.btn, !email.trim() && styles.btnDisabled]}
                    onPress={handleSendOTP}
                    disabled={!email.trim()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnText}>Continue</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>Enter code</Text>
                  <Text style={styles.cardSub}>Sent to {email}</Text>

                  <TextInput
                    ref={hiddenRef}
                    style={styles.hiddenInput}
                    value={otp}
                    onChangeText={handleOtpChange}
                    keyboardType="numeric"
                    maxLength={6}
                    autoFocus
                    keyboardAppearance="dark"
                  />

                  <TouchableWithoutFeedback
                    onPress={() => hiddenRef.current?.focus()}
                  >
                    <View style={styles.otpRow}>
                      {otpArray.map((d, i) => (
                        <View
                          key={i}
                          style={[
                            styles.otpBox,
                            !!d && styles.otpFilled,
                            otp.length === i && styles.otpActive,
                          ]}
                        >
                          <Text style={styles.otpDigit}>{d}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableWithoutFeedback>

                  <TouchableOpacity
                    onPress={() => {
                      setStep("email");
                      setOtp("");
                    }}
                    style={styles.backBtn}
                  >
                    <Text style={styles.backText}>← Use a different email</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.poweredBy}>
                <Text style={styles.poweredText}>Powered by Dynamic</Text>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#030712" },
  flex: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#030712",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: { color: "#f9fafb", fontSize: 16 },
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#14b8a6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoText: { color: "#030712", fontSize: 22, fontWeight: "800" },
  heroTitle: {
    fontSize: 40,
    fontWeight: "700",
    color: "#f9fafb",
    textAlign: "center",
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 24,
  },
  card: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 28,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f9fafb",
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 15,
    color: "#9ca3af",
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#1f2937",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 16,
    color: "#f9fafb",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  btn: {
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#030712", fontSize: 17, fontWeight: "700" },
  hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  otpBox: {
    width: 48,
    height: 58,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  otpFilled: { backgroundColor: "#1a2035" },
  otpActive: { borderColor: "#14b8a6" },
  otpDigit: { fontSize: 24, fontWeight: "600", color: "#f9fafb" },
  backBtn: { paddingVertical: 12, alignItems: "center" },
  backText: { color: "#14b8a6", fontSize: 15, fontWeight: "500" },
  poweredBy: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  poweredText: { color: "#9ca3af", fontSize: 13 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1f2937",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
  googleBtnText: { color: "#f9fafb", fontSize: 16, fontWeight: "600" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  dividerText: { color: "#9ca3af", fontSize: 13 },
});
