/**
 * Iron Finance Service
 *
 * Service layer for Iron Finance API integration.
 * Handles customers, wallets, banks, onramps, offramps, quotes, and KYC.
 *
 * Iron Finance (by MoonPay) provides stablecoin payment infrastructure:
 * - Onramp: Turn fiat into stablecoins
 * - Offramp: Turn stablecoins into fiat
 * - Swap: Exchange stablecoins across chains
 * - Virtual Accounts: Receive payments via named bank accounts
 * - Third Party Payments: External payout/payin services
 *
 * Reference: https://docs.iron.xyz
 * GitHub: https://github.com/ironxyz/mcp-server
 */

import { env } from "@/env";
import { randomUUID } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export type IronEnvironment = "production" | "sandbox";
export type CustomerType = "individual" | "business";
export type KYCStatus = "not_started" | "pending" | "approved" | "rejected";
// Iron API uses capitalized blockchain names
export type BlockchainType =
  | "Ethereum"
  | "Solana"
  | "Polygon"
  | "Arbitrum"
  | "Base"
  | "Stellar"
  | "Citrea";
export type FiatCurrency = "USD" | "EUR" | "GBP" | "BRL" | "MXN";
export type CryptoCurrency = "USDC" | "USDT" | "USDB" | "EURC";

/** Iron API GET /fiatcurrencies - supported fiat currency with countries */
export interface IronFiatCurrencyCountry {
  code: string; // ISO 3166-1 Alpha-2
}
export interface IronFiatCurrency {
  code: string; // ISO 4217 e.g. EUR
  name: string; // e.g. Euro
  countries: IronFiatCurrencyCountry[];
}
export type PaymentRail = "ach" | "wire" | "sepa" | "pix" | "faster_payments";
export type RampStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

// Customer Types
export interface CreateCustomerRequest {
  type: CustomerType;
  email: string;
  first_name?: string;
  last_name?: string;
  business_name?: string;
  phone_number?: string;
  date_of_birth?: string; // YYYY-MM-DD
  country_code?: string; // ISO 3166-1 alpha-2
  metadata?: Record<string, unknown>;
}

export interface Customer {
  id: string;
  type: CustomerType;
  email: string;
  first_name?: string;
  last_name?: string;
  business_name?: string;
  phone_number?: string;
  date_of_birth?: string;
  country_code?: string;
  kyc_status: KYCStatus;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}


// Wallet/Address Types
// Note: Iron API uses "addresses" for crypto destination addresses
export interface RegisterSelfHostedAddressRequest {
  customer_id: string;
  blockchain: BlockchainType;
  address: string;
  signature: string;
  message: string;
}


export interface Wallet {
  id: string;
  customer_id?: string;
  blockchain: BlockchainType;
  wallet_address: string;
  /** Present in list responses for UI compatibility */
  address?: string;
  is_hosted: boolean;
  label?: string;
  created_at: string;
  updated_at: string;
}

/** GET /addresses/crypto/{customer_id} response item */
export interface VerifiedAddressResponse {
  id: string;
  wallet_address: string;
  address_type: "Hosted" | "SelfHosted";
  blockchain: string;
  created_at: string;
  disabled?: boolean;
  proof_message?: string;
  proof_signature?: string;
  vasp_did?: string | null;
}

// Bank/Fiat Address Types
// Iron API uses nested structure for fiat address registration

export interface RecipientAddress {
  street: string;
  city: string;
  state: string;
  country: { code: string };
  postal_code: string;
}

export interface SEPAAccountIdentifier {
  type: "SEPA";
  iban: string;
}

export interface ACHAccountIdentifier {
  type: "ACH";
  routing_number: string;
  account_number: string;
}

export interface WireAccountIdentifier {
  type: "Wire";
  routing_number: string;
  account_number: string;
}

export type BankAccountIdentifier =
  | SEPAAccountIdentifier
  | ACHAccountIdentifier
  | WireAccountIdentifier;

export interface IndividualRecipient {
  type: "Individual";
  given_name: string;
  family_name: string;
}

export interface BusinessRecipient {
  type: "Business";
  name: string;
}

export type RecipientName = IndividualRecipient | BusinessRecipient;

export interface RecipientBankAccount {
  recipient: RecipientName;
  provider_name: string;
  provider_country: { code: string };
  account_identifier: BankAccountIdentifier;
  address: RecipientAddress;
  is_third_party: boolean;
  phone_number?: string;
  email_address?: { email: string };
}

export interface RegisterFiatAddressRequest {
  customer_id: string;
  currency: { code: string };
  bank_details: RecipientBankAccount;
  label?: string;
}

// Simplified request format for the API route
export interface SimplifiedBankAccountRequest {
  customer_id: string;
  currency: FiatCurrency;
  account_holder_name: string;
  iban?: string; // For SEPA
  routing_number?: string; // For ACH/Wire
  account_number?: string; // For ACH/Wire
  bank_name: string;
  bank_country: string; // ISO 3166-1 alpha-2
  // Address fields
  street: string;
  city: string;
  state: string;
  country: string; // ISO 3166-1 alpha-2
  postal_code: string;
  label?: string;
  is_third_party?: boolean;
}

export interface FiatAddress {
  id: string;
  customer_id: string;
  currency: string;
  bank_name: string;
  country: string;
  status:
    | "AuthorizationRequired"
    | "AuthorizationFailed"
    | "RegistrationPending"
    | "RegistrationFailed"
    | "Registered";
  ownership_verified: boolean;
  is_third_party: boolean;
  label?: string;
  created_at: string;
  updated_at: string;
  /** From API list response */
  bank_account_identifier?: {
    type?: string;
    iban?: string;
    [k: string]: unknown;
  };
  /** Set in list response for UI (alias of bank_account_identifier) */
  account_identifier?: { type?: string; iban?: string; [k: string]: unknown };
  /** Set in list response for UI (from bank_account_identifier.iban) */
  iban?: string;
}

// Legacy type alias
export type RegisterBankAccountRequest = SimplifiedBankAccountRequest;
export type BankAccount = FiatAddress;

/** GET /addresses/fiat/{customer_id} response */
export interface PagedFiatAddresses {
  items: FiatAddress[];
  cursor?: string | null;
  prev_cursor?: string | null;
}

// Quote Types
export interface OnrampQuoteRequest {
  customer_id: string;
  source_currency: FiatCurrency;
  destination_currency: CryptoCurrency;
  source_amount?: number; // Amount in cents
  destination_amount?: number; // Amount in smallest unit
  payment_rail: PaymentRail;
  wallet_address: string; // The blockchain address (EVM 0x... or Solana base58) — must match registered wallet's chain
  wallet_id?: string; // Iron Finance registered wallet ID — preferred over wallet_address when available
  blockchain?: BlockchainType; // The blockchain to use for the destination currency
}

export interface OfframpQuoteRequest {
  customer_id: string;
  source_currency: CryptoCurrency;
  destination_currency: FiatCurrency;
  source_amount?: number; // Amount in smallest unit
  destination_amount?: number; // Amount in cents
  bank_account_id: string; // The bank IBAN for receiving fiat
  bank_id?: string; // Iron Finance registered bank account ID — preferred over IBAN when available
  blockchain?: BlockchainType; // The blockchain to use for the source currency
}

export interface Quote {
  id: string;
  type: "onramp" | "offramp";
  source_currency: string;
  destination_currency: string;
  source_amount: number;
  destination_amount: number;
  exchange_rate: number;
  fees: {
    network_fee?: number;
    service_fee?: number;
    total_fee: number;
  };
  expires_at: string;
  created_at: string;
}

// Iron API Quote Response (from /api/autoramps/quote)
export interface IronQuoteResponse {
  quote_id: string;
  customer_id: string;
  amount_in?: {
    amount: string;
    currency: { code: string; type: string };
  };
  amount_out?: {
    amount: string;
    currency: { code: string; type: string };
  };
  source_currency?: {
    blockchain?: string;
    token?: string;
    code?: string;
    type?: string;
  };
  destination_currency?: {
    blockchain?: string;
    token?: string;
    code?: string;
    type?: string;
  };
  rate: string;
  rate_expiry_policy: string;
  valid_until: string;
  signature: string;
  is_third_party: boolean;
  fee: {
    total_fee?: { amount: string; currency: { code: string; type: string } };
    iron_fee?: { amount: string; currency: { code: string; type: string } };
    network_fee?: { amount: string; currency: { code: string; type: string } };
    banking_fee?: { amount: string; currency: { code: string; type: string } };
  };
}

// Iron API Autoramp Response (from /api/autoramps)
export interface IronAutorampResponse {
  id: string;
  kind: "Onramp" | "Offramp" | "Swap";
  status: string;
  created_at: string;
  is_third_party: boolean;
  fee_profile_id?: string;
  deposit_rails?: Array<{
    iban?: string;
    name?: string;
    bic?: string;
    beneficiary_name?: string;
    address?: string;
    phone?: string;
    account_number?: string;
    routing_number?: string;
    account_holder_name?: string;
    account_holder_address?: string;
    bank_address?: string;
    rails?: string[]; // e.g. ["ACH", "Wire", "RTP"]
  }>;
  destination_currency?: {
    blockchain?: string;
    token?: string;
    code?: string;
    type?: string;
  };
  source_currencies?: Array<{
    blockchain?: string;
    token?: string;
    code?: string;
    type?: string;
  }>;
  recipient?: {
    customer_id?: string;
    account_identifier?: {
      iban?: string;
      type?: string;
    };
    provider_name?: string;
    is_third_party?: boolean;
  };
  quote?: {
    quote_id?: string;
    amount_in?: { amount: string; currency: { code: string; type: string } };
    amount_out?: { amount: string; currency: { code: string; type: string } };
    rate?: string;
    valid_until?: string;
    fee?: {
      total_fee?: { amount: string; currency: { code: string; type: string } };
    };
  };
  external_id?: string;
  name?: string;
}

// Onramp Types
export interface CreateOnrampRequest {
  quote_id: string;
  customer_id: string;
  wallet_address: string; // The actual blockchain wallet address (EVM 0x... or Solana base58)
  wallet_id?: string; // Iron Finance registered wallet ID — preferred over wallet_address when available
  bank_account_id?: string; // Optional if using virtual account
  blockchain?: BlockchainType; // The blockchain to use
  source_currency?: FiatCurrency; // Source fiat currency
  destination_currency?: CryptoCurrency; // Destination crypto currency
}

export interface Onramp {
  id: string;
  customer_id: string;
  quote_id: string;
  wallet_id: string;
  status: RampStatus;
  source_currency: FiatCurrency;
  destination_currency: CryptoCurrency;
  source_amount: number;
  destination_amount: number;
  transaction_hash?: string;
  payment_instructions?: {
    account_number: string;
    routing_number?: string;
    bank_name?: string;
    bic?: string;
    beneficiary_name?: string;
    address?: string;
    phone?: string;
  };
  estimated_completion_time?: string;
  created_at: string;
  updated_at: string;
}

// Offramp Types
export interface CreateOfframpRequest {
  quote_id: string;
  customer_id: string;
  bank_account_id: string; // The bank IBAN for receiving fiat
  bank_id?: string; // Iron Finance registered bank account ID — preferred over IBAN when available
  blockchain?: BlockchainType; // The blockchain to use
  source_currency?: CryptoCurrency; // Source crypto currency
  destination_currency?: FiatCurrency; // Destination fiat currency
}

export interface Offramp {
  id: string;
  customer_id: string;
  quote_id: string;
  wallet_id: string;
  bank_account_id: string;
  status: RampStatus;
  source_currency: CryptoCurrency;
  destination_currency: FiatCurrency;
  source_amount: number;
  destination_amount: number;
  transaction_hash?: string;
  estimated_completion_time?: string;
  created_at: string;
  updated_at: string;
}

// Third Party Payment Types

// KYC Types
export interface StartKYCRequest {
  customer_id: string;
  return_url?: string;
}

export interface KYCSession {
  id: string;
  customer_id: string;
  status: KYCStatus;
  verification_url?: string;
  created_at: string;
  updated_at: string;
}

// Signings Types
export interface RequiredSigning {
  id: string;
  display_name: string;
  type: "Url" | "Text";
  url?: string;
  text?: string;
}

export interface CreateSigningRequest {
  content_id: string;
  content_type: "Url" | "Text";
  signed: boolean;
}

export interface Signing {
  id: string;
  content_id: string;
  content_type: "Url" | "Text";
  signed: boolean;
  created_at: string;
}

// Sandbox Testing Types
export interface UpdateIdentificationStatusRequest {
  approved: boolean;
}

export interface Identification {
  id: string;
  customer_id: string;
  status:
    | "Pending"
    | "Processed"
    | "PendingReview"
    | "Approved"
    | "Declined"
    | "Expired";
  url?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// IRON FINANCE CLIENT
// =============================================================================

class IronFinanceClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly environment: IronEnvironment;

  constructor() {
    this.environment = (env.IRON_ENVIRONMENT ||
      "production") as IronEnvironment;
    this.apiKey = env.IRON_API_KEY || "";

    // Set base URL based on environment
    this.apiUrl =
      this.environment === "sandbox"
        ? "https://api.sandbox.iron.xyz"
        : "https://api.iron.xyz";

    if (!this.apiKey) {
      console.warn(
        "Iron Finance API key not configured. IRON_API_KEY is required."
      );
    }
  }

  private getHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json; charset=utf-8",
      "X-API-Key": this.apiKey,
    };

    if (idempotencyKey) {
      headers["IDEMPOTENCY-KEY"] = idempotencyKey;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorData = JSON.parse(errorText);
        console.error('[Iron API] Error response:', errorData);
        errorMessage = JSON.stringify(errorData, null, 2);
      } catch {
        console.error('[Iron API] Error text:', errorText);
      }
      throw new Error(
        `Iron Finance API error: ${response.status} - ${errorMessage}`
      );
    }
    return response.json();
  }

  // =============================================================================
  // CUSTOMER METHODS
  // =============================================================================

  /**
   * Create a new customer (individual or business)
   */
  async createCustomer(
    request: CreateCustomerRequest,
    idempotencyKey?: string
  ): Promise<Customer> {
    // Transform request to match Iron Finance API schema
    const name =
      request.business_name ||
      `${request.first_name || ""} ${request.last_name || ""}`.trim();

    const ironRequest = {
      customer_type: request.type === "individual" ? "Person" : "Business",
      email: request.email,
      name: name || request.email.split("@")[0],
      external_id: request.metadata?.external_id as string | undefined,
    };

    const response = await fetch(`${this.apiUrl}/api/customers`, {
      method: "POST",
      headers: this.getHeaders(idempotencyKey || randomUUID()),
      body: JSON.stringify(ironRequest),
    });

    return this.handleResponse<Customer>(response);
  }

  /**
   * Get a customer by ID
   */
  async getCustomer(customerId: string): Promise<Customer> {
    const response = await fetch(`${this.apiUrl}/api/customers/${customerId}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    return this.handleResponse<Customer>(response);
  }


  // =============================================================================
  // CURRENCIES
  // =============================================================================

  /**
   * List all available fiat currencies supported by Iron.
   * GET /api/fiatcurrencies
   */
  async listFiatCurrencies(): Promise<IronFiatCurrency[]> {
    const response = await fetch(`${this.apiUrl}/api/fiatcurrencies`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    return this.handleResponse<IronFiatCurrency[]>(response);
  }

  // =============================================================================
  // WALLET METHODS
  // =============================================================================

  /**
   * Register a self-hosted wallet address (user manages their own keys)
   * Requires signature proof of ownership
   * POST /api/addresses/crypto/selfhosted
   */
  async registerHostedWallet(
    request: RegisterSelfHostedAddressRequest,
    idempotencyKey?: string
  ): Promise<Wallet> {
    const response = await fetch(
      `${this.apiUrl}/api/addresses/crypto/selfhosted`,
      {
        method: "POST",
        headers: this.getHeaders(idempotencyKey || randomUUID()),
        body: JSON.stringify({
          customer_id: request.customer_id,
          blockchain: request.blockchain,
          address: request.address,
          signature: request.signature,
          message: request.message,
        }),
      }
    );

    return this.handleResponse<Wallet>(response);
  }


  /**
   * List wallets for a customer.
   * Uses GET /addresses/crypto/{customer_id} (filter=All).
   * Returns empty list when the customer has no wallets (API may return 404).
   */
  async listWallets(customerId: string): Promise<{ data: Wallet[] }> {
    const url = `${this.apiUrl}/api/addresses/crypto/${customerId}?filter=All`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (response.status === 404) {
      return { data: [] };
    }
    const raw = await this.handleResponse<VerifiedAddressResponse[]>(response);
    const data = (Array.isArray(raw) ? raw : []).map((a) => ({
      id: a.id,
      customer_id: customerId,
      blockchain: a.blockchain as BlockchainType,
      wallet_address: a.wallet_address,
      address: a.wallet_address,
      is_hosted: a.address_type === "Hosted",
      created_at: a.created_at,
      updated_at: a.created_at,
    }));
    return { data };
  }

  // =============================================================================
  // BANK ACCOUNT METHODS
  // =============================================================================

  /**
   * Register a fiat bank address for a customer
   * Transforms simplified request into Iron API format
   */
  async registerBankAccount(
    request: SimplifiedBankAccountRequest,
    idempotencyKey?: string
  ): Promise<FiatAddress> {
    // Parse the account holder name for individual recipients
    const nameParts = request.account_holder_name.trim().split(/\s+/);
    const givenName = nameParts[0] || "";
    const familyName = nameParts.slice(1).join(" ") || nameParts[0] || "";

    // Build the account identifier based on available data
    let accountIdentifier: BankAccountIdentifier;
    if (request.iban) {
      accountIdentifier = {
        type: "SEPA",
        iban: request.iban,
      };
    } else if (request.routing_number && request.account_number) {
      accountIdentifier = {
        type: "ACH",
        routing_number: request.routing_number,
        account_number: request.account_number,
      };
    } else {
      throw new Error(
        "Either IBAN (for SEPA) or routing_number + account_number (for ACH/Wire) is required"
      );
    }

    // Build the full Iron API request
    const ironRequest: RegisterFiatAddressRequest = {
      customer_id: request.customer_id,
      currency: { code: request.currency },
      bank_details: {
        recipient: {
          type: "Individual",
          given_name: givenName,
          family_name: familyName,
        },
        provider_name: request.bank_name,
        provider_country: { code: request.bank_country },
        account_identifier: accountIdentifier,
        address: {
          street: request.street,
          city: request.city,
          state: request.state,
          country: { code: request.country },
          postal_code: request.postal_code,
        },
        is_third_party: request.is_third_party ?? false,
      },
      label: request.label,
    };

    const response = await fetch(`${this.apiUrl}/api/addresses/fiat`, {
      method: "POST",
      headers: this.getHeaders(idempotencyKey || randomUUID()),
      body: JSON.stringify(ironRequest),
    });

    return this.handleResponse<FiatAddress>(response);
  }


  /**
   * List fiat addresses (bank accounts) for a customer.
   * Uses GET /addresses/fiat/{customer_id}. Returns empty list on 404.
   */
  async listBankAccounts(customerId: string): Promise<{ data: BankAccount[] }> {
    const response = await fetch(
      `${this.apiUrl}/api/addresses/fiat/${customerId}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    if (response.status === 404) {
      return { data: [] };
    }
    const body = await this.handleResponse<PagedFiatAddresses>(response);
    const items = body?.items ?? [];
    // Map for UI: expose account_identifier and iban from bank_account_identifier
    const data = items.map((item) => ({
      ...item,
      account_identifier: item.bank_account_identifier,
      iban:
        item.bank_account_identifier && "iban" in item.bank_account_identifier
          ? item.bank_account_identifier.iban
          : undefined,
    }));
    return { data };
  }


  // =============================================================================
  // QUOTE METHODS (via Autoramp API)
  // =============================================================================

  /**
   * Get an onramp quote (fiat to crypto)
   * Uses GET /api/autoramps/quote with query parameters
   * Reference: https://docs.iron.xyz/reference-sandbox/autoramp/get-a-quote-for-an-autoramp
   */
  async getOnrampQuote(request: OnrampQuoteRequest): Promise<Quote> {
    const params = new URLSearchParams({
      customer_id: request.customer_id,
      source_currency_code: request.source_currency,
      destination_currency_code: request.destination_currency,
      destination_currency_chain: request.blockchain || "Base",
      rate_expiry_policy: "Return",
      expiry_in_hours: "24",
      is_third_party: "false",
    });
    // Prefer recipient_account_id (registered wallet UUID) over raw address —
    // Iron Finance requires the ID for some destination currencies (e.g. USDC on Solana).
    if (request.wallet_id) {
      params.set("recipient_account_id", request.wallet_id);
    } else {
      params.set("recipient_account", request.wallet_address);
    }

    if (request.source_amount) {
      // Convert from cents to decimal string
      params.set("amount_in", (request.source_amount / 100).toString());
    } else if (request.destination_amount) {
      // Convert from smallest unit to decimal string
      params.set(
        "amount_out",
        (request.destination_amount / 1000000).toString()
      );
    }

    const response = await fetch(
      `${this.apiUrl}/api/autoramps/quote?${params.toString()}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    const data = await this.handleResponse<IronQuoteResponse>(response);
    return this.mapIronQuoteToQuote(data, "onramp");
  }

  /**
   * Get an offramp quote (crypto to fiat)
   * Uses GET /api/autoramps/quote with query parameters
   * Reference: https://docs.iron.xyz/reference-sandbox/autoramp/get-a-quote-for-an-autoramp
   */
  async getOfframpQuote(request: OfframpQuoteRequest): Promise<Quote> {
    const params = new URLSearchParams({
      customer_id: request.customer_id,
      source_currency_code: request.source_currency,
      source_currency_chain: request.blockchain || "Base",
      destination_currency_code: request.destination_currency,
      rate_expiry_policy: "Return",
      expiry_in_hours: "24",
      is_third_party: "false",
    });
    // Prefer recipient_account_id (registered bank UUID) over raw IBAN —
    // Iron Finance requires the ID for some destination currencies.
    if (request.bank_id) {
      params.set("recipient_account_id", request.bank_id);
    } else {
      params.set("recipient_account", request.bank_account_id);
    }

    if (request.source_amount) {
      // Convert from smallest unit to decimal string
      params.set("amount_in", (request.source_amount / 1000000).toString());
    } else if (request.destination_amount) {
      // Convert from cents to decimal string
      params.set("amount_out", (request.destination_amount / 100).toString());
    }

    const response = await fetch(
      `${this.apiUrl}/api/autoramps/quote?${params.toString()}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    const data = await this.handleResponse<IronQuoteResponse>(response);
    return this.mapIronQuoteToQuote(data, "offramp");
  }

  /**
   * Map Iron's quote response to our Quote type
   */
  private mapIronQuoteToQuote(
    data: IronQuoteResponse,
    type: "onramp" | "offramp"
  ): Quote {
    return {
      id: data.quote_id,
      type,
      source_currency:
        data.source_currency?.token || data.amount_in?.currency?.code || "",
      destination_currency:
        data.destination_currency?.token ||
        data.amount_out?.currency?.code ||
        "",
      source_amount:
        parseFloat(data.amount_in?.amount || "0") *
        (type === "onramp" ? 100 : 1000000),
      destination_amount:
        parseFloat(data.amount_out?.amount || "0") *
        (type === "onramp" ? 1000000 : 100),
      exchange_rate: parseFloat(data.rate || "1"),
      fees: {
        network_fee: parseFloat(data.fee?.network_fee?.amount || "0") * 100,
        service_fee: parseFloat(data.fee?.iron_fee?.amount || "0") * 100,
        total_fee: parseFloat(data.fee?.total_fee?.amount || "0") * 100,
      },
      expires_at: data.valid_until,
      created_at: new Date().toISOString(),
    };
  }


  // =============================================================================
  // AUTORAMP METHODS (Unified Onramp/Offramp)
  // =============================================================================

  /**
   * Create an onramp transaction (fiat to crypto)
   * Uses POST /api/autoramps
   * Reference: https://docs.iron.xyz/reference-sandbox/autoramp/create-a-new-autoramp
   */
  async createOnramp(
    request: CreateOnrampRequest,
    idempotencyKey?: string
  ): Promise<Onramp> {
    // For onramp: source is fiat, destination is crypto
    // recipient_account is where the crypto goes (user's wallet)
    const blockchain = request.blockchain || "Base";
    const destinationCurrency = request.destination_currency || "USDC";
    const sourceCurrency = request.source_currency || "EUR";

    const autorampRequest = {
      customer_id: request.customer_id,
      destination_currency: {
        type: "Crypto",
        blockchain: blockchain,
        token: destinationCurrency,
      },
      recipient_account: {
        type: "Crypto",
        chain: blockchain,
        address: request.wallet_address,
      },
      source_currencies: [
        {
          type: "Fiat",
          code: sourceCurrency,
        },
      ],
    };

    const response = await fetch(`${this.apiUrl}/api/autoramps`, {
      method: "POST",
      headers: this.getHeaders(idempotencyKey || randomUUID()),
      body: JSON.stringify(autorampRequest),
    });

    const data = await this.handleResponse<IronAutorampResponse>(response);
    return this.mapAutorampToOnramp(data);
  }

  /**
   * Map Iron autoramp response to Onramp type
   */
  private mapAutorampToOnramp(data: IronAutorampResponse): Onramp {
    return {
      id: data.id,
      customer_id: data.recipient?.customer_id || "",
      quote_id: data.quote?.quote_id || "",
      wallet_id: "",
      status: this.mapAutorampStatus(data.status),
      source_currency: "EUR" as FiatCurrency,
      destination_currency: "USDC" as CryptoCurrency,
      source_amount: parseFloat(data.quote?.amount_in?.amount || "0") * 100,
      destination_amount:
        parseFloat(data.quote?.amount_out?.amount || "0") * 1000000,
      payment_instructions: data.deposit_rails?.[0]
        ? {
            account_number: data.deposit_rails[0].iban || "",
            bank_name: data.deposit_rails[0].name || "Iron Bank",
            bic: data.deposit_rails[0].bic,
            beneficiary_name: data.deposit_rails[0].beneficiary_name,
            address: data.deposit_rails[0].address,
            phone: data.deposit_rails[0].phone,
          }
        : undefined,
      created_at: data.created_at,
      updated_at: data.created_at,
    };
  }

  /**
   * Map Iron autoramp status to our RampStatus
   */
  private mapAutorampStatus(status: string): RampStatus {
    const statusMap: Record<string, RampStatus> = {
      Created: "pending",
      EditPending: "pending",
      Authorized: "processing",
      DepositAccountAdded: "processing",
      Approved: "completed",
      Rejected: "failed",
      Cancelled: "cancelled",
    };
    return statusMap[status] || "pending";
  }


  // =============================================================================
  // OFFRAMP METHODS
  // =============================================================================

  /**
   * Create an offramp transaction (crypto to fiat)
   * Uses POST /api/autoramps
   * Reference: https://docs.iron.xyz/reference-sandbox/autoramp/create-a-new-autoramp
   */
  async createOfframp(
    request: CreateOfframpRequest,
    idempotencyKey?: string
  ): Promise<Offramp> {
    // For offramp: source is crypto, destination is fiat
    // recipient_account is where the fiat goes (user's bank account)
    const blockchain = request.blockchain || "Base";
    const sourceCurrency = request.source_currency || "USDC";
    const destinationCurrency = request.destination_currency || "EUR";

    const autorampRequest = {
      customer_id: request.customer_id,
      destination_currency: {
        type: "Fiat",
        code: destinationCurrency,
      },
      recipient_account: {
        type: "Fiat",
        account_identifier: {
          type: "SEPA",
          iban: request.bank_account_id,
        },
      },
      source_currencies: [
        {
          type: "Crypto",
          blockchain: blockchain,
          token: sourceCurrency,
        },
      ],
    };

    const response = await fetch(`${this.apiUrl}/api/autoramps`, {
      method: "POST",
      headers: this.getHeaders(idempotencyKey || randomUUID()),
      body: JSON.stringify(autorampRequest),
    });

    const data = await this.handleResponse<IronAutorampResponse>(response);
    return this.mapAutorampToOfframp(data);
  }

  /**
   * Map Iron autoramp response to Offramp type
   */
  private mapAutorampToOfframp(data: IronAutorampResponse): Offramp {
    return {
      id: data.id,
      customer_id: data.recipient?.customer_id || "",
      quote_id: data.quote?.quote_id || "",
      wallet_id: "",
      bank_account_id: data.recipient?.account_identifier?.iban || "",
      status: this.mapAutorampStatus(data.status),
      source_currency: "USDC" as CryptoCurrency,
      destination_currency: "EUR" as FiatCurrency,
      source_amount: parseFloat(data.quote?.amount_in?.amount || "0") * 1000000,
      destination_amount:
        parseFloat(data.quote?.amount_out?.amount || "0") * 100,
      created_at: data.created_at,
      updated_at: data.created_at,
    };
  }



  // =============================================================================
  // KYC METHODS
  // =============================================================================

  /**
   * Start KYC verification for a customer
   * Creates a hosted identification session via POST /api/customers/{id}/identifications/v2
   * Returns a URL where the customer can complete KYC verification
   */
  async startKYC(
    request: StartKYCRequest,
    idempotencyKey?: string
  ): Promise<KYCSession> {
    const response = await fetch(
      `${this.apiUrl}/api/customers/${request.customer_id}/identifications/v2`,
      {
        method: "POST",
        headers: this.getHeaders(idempotencyKey || randomUUID()),
        body: JSON.stringify({
          type: "Link",
        }),
      }
    );

    return this.handleResponse<KYCSession>(response);
  }


  // =============================================================================
  // SIGNINGS METHODS
  // =============================================================================

  /**
   * Get required signings for a customer
   * These are documents the customer must sign to become active
   */
  async getRequiredSignings(customerId: string): Promise<RequiredSigning[]> {
    const response = await fetch(
      `${this.apiUrl}/api/customers/${customerId}/required-signings`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<RequiredSigning[]>(response);
  }

  /**
   * Create a signing for a customer
   * Call this after the customer has reviewed/signed a required document
   */
  async createSigning(
    customerId: string,
    request: CreateSigningRequest,
    idempotencyKey?: string
  ): Promise<Signing> {
    const response = await fetch(
      `${this.apiUrl}/api/customers/${customerId}/signings`,
      {
        method: "POST",
        headers: this.getHeaders(idempotencyKey || randomUUID()),
        body: JSON.stringify(request),
      }
    );

    return this.handleResponse<Signing>(response);
  }

  // =============================================================================
  // SANDBOX TESTING METHODS
  // =============================================================================

  /**
   * Get customer's identifications
   */
  async getCustomerIdentifications(
    customerId: string
  ): Promise<Identification[]> {
    const response = await fetch(
      `${this.apiUrl}/api/customers/${customerId}/identifications`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<Identification[]>(response);
  }

  /**
   * Update identification status (SANDBOX ONLY)
   * Use this to approve or reject an identification for testing
   */
  async updateIdentificationStatus(
    identificationId: string,
    approved: boolean,
    idempotencyKey?: string
  ): Promise<Identification> {
    const response = await fetch(
      `${this.apiUrl}/api/sandbox/identification/${identificationId}`,
      {
        method: "POST",
        headers: this.getHeaders(idempotencyKey || randomUUID()),
        body: JSON.stringify({ approved }),
      }
    );

    return this.handleResponse<Identification>(response);
  }

  /**
   * Check if running in sandbox environment
   */
  isSandbox(): boolean {
    return this.environment === "sandbox";
  }

  // =============================================================================
  // AUTORAMPS METHODS
  // =============================================================================

  /**
   * List all autoramps (onramps and offramps) for a customer
   * Reference: https://docs.iron.xyz/reference-sandbox/autoramp/list-autoramps-for-a-customer
   */
  async listAutoramps(customerId: string): Promise<any> {
    const response = await fetch(
      `${this.apiUrl}/api/autoramps?customer_id=${customerId}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<any>(response);
  }

}


export const ironClient = new IronFinanceClient();
