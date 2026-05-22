import {
  NetworkNotAddedError,
  NetworkAddingUnavailableError,
  WalletAccountNotSelectedError,
} from "@dynamic-labs-sdk/client";
import { isGasSponsorshipError } from "@dynamic-labs-sdk/zerodev";
import { SponsorTransactionError } from "@/lib/dynamic";

/**
 * Parsed error with title and description
 */
export interface ParsedError {
  title: string;
  description?: string;
}

/**
 * Extract error message from unknown error type
 * Handles Dynamic SDK specific error messages
 */
export function getErrorMessage(
  error: unknown,
  defaultMessage = "Something went wrong. Please try again.",
): string {
  const parsed = parseError(error, defaultMessage);
  return parsed.description
    ? `${parsed.title}: ${parsed.description}`
    : parsed.title;
}

/**
 * Parse error into structured title and description
 * Checks Dynamic SDK typed errors first, then falls back to string matching
 */
export function parseError(
  error: unknown,
  defaultMessage = "Something went wrong. Please try again.",
): ParsedError {
  if (!error) return { title: "" };

  // Check Dynamic SDK typed errors first
  if (error instanceof NetworkNotAddedError) {
    return {
      title: "Network not added",
      description: "This network needs to be added to your wallet first.",
    };
  }

  if (error instanceof NetworkAddingUnavailableError) {
    return {
      title: "Cannot add network",
      description: "Your wallet doesn't support adding networks automatically.",
    };
  }

  if (error instanceof WalletAccountNotSelectedError) {
    return {
      title: "Wallet not selected",
      description: "Please select an active wallet account to continue.",
    };
  }

  if (isGasSponsorshipError(error)) {
    return {
      title: "Gas sponsorship unavailable",
      description:
        "This transaction doesn't qualify for gas sponsorship. You'll need to pay gas fees.",
    };
  }

  if (error instanceof SponsorTransactionError) {
    return {
      title: "Solana gas sponsorship failed",
      description:
        "Unable to sponsor this Solana transaction. The transaction was not sent.",
    };
  }

  // Fall back to string matching for other errors
  let message = "";

  if (typeof error === "object" && error !== null && "message" in error) {
    message = (error as { message: string }).message;
  } else if (typeof error === "string") {
    message = error;
  } else {
    return { title: defaultMessage };
  }

  // Handle specific error patterns
  if (message === 'request/body/email must match format "email"') {
    return { title: "Invalid email address" };
  }

  if (message.includes("rate limit")) {
    return {
      title: "Too many attempts",
      description: "Please try again later.",
    };
  }

  if (message.includes("invalid otp") || message.includes("Invalid OTP")) {
    return { title: "Invalid verification code" };
  }

  // Insufficient funds error
  if (
    message.includes("insufficient funds") ||
    message.includes("exceeds the balance")
  ) {
    return {
      title: "Insufficient funds",
      description:
        "Your account doesn't have enough balance to cover the transaction amount plus gas fees.",
    };
  }

  // User rejected transaction
  if (message.includes("User rejected") || message.includes("user rejected")) {
    return {
      title: "Transaction cancelled",
      description: "You rejected the transaction.",
    };
  }

  // Network/RPC errors
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("ETIMEDOUT")
  ) {
    return {
      title: "Network error",
      description: "Unable to connect to the network. Please try again.",
    };
  }

  // For long technical messages, truncate and provide a generic title
  if (message.length > 100) {
    // Try to extract a meaningful part
    const shortMessage = message.split(".")[0].split(":")[0].trim();
    if (shortMessage.length < 80) {
      return { title: shortMessage };
    }
    return {
      title: "Transaction failed",
      description: shortMessage.substring(0, 100) + "...",
    };
  }

  return { title: message };
}
