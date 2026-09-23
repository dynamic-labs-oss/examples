//! Environment-driven configuration. Loaded from `.env` in the crate root
//! the first time anything in this module is touched.
//!
//! Mirrors `lib/config.py` in the Python example.

use std::sync::OnceLock;

#[derive(Debug, Clone)]
pub struct Config {
    pub dynamic_api_token: String,
    pub dynamic_env_id: String,
    pub dynamic_base_api_url: Option<String>,
    pub evm_rpc_url: Option<String>,
    pub solana_rpc_url: Option<String>,
}

/// Base Sepolia is the default EVM testnet for these examples.
pub const BASE_SEPOLIA_CHAIN_ID: u64 = 84532;
pub const EVM_EXPLORER_BASE: &str = "https://sepolia.basescan.org";
pub const SOLANA_EXPLORER_BASE: &str = "https://explorer.solana.com";
pub const SOLANA_EXPLORER_QUERY: &str = "?cluster=devnet";

/// Demo tuning knobs.
pub const MAX_USDC_AMOUNT: u64 = 1000;
pub const WALLET_CREATION_CONCURRENCY: usize = 5;
pub const TRANSACTION_CONCURRENCY: usize = 25;

static CONFIG: OnceLock<Config> = OnceLock::new();

pub fn get() -> &'static Config {
    CONFIG.get_or_init(load_from_env)
}

fn load_from_env() -> Config {
    // Best-effort .env load — missing file is fine if the caller exported
    // the variables in their shell.
    let _ = dotenvy::dotenv();

    Config {
        dynamic_api_token: std::env::var("DYNAMIC_API_TOKEN").unwrap_or_default(),
        dynamic_env_id: std::env::var("DYNAMIC_ENV_ID").unwrap_or_default(),
        dynamic_base_api_url: optional_env("DYNAMIC_BASE_API_URL"),
        evm_rpc_url: optional_env("EVM_RPC_URL"),
        solana_rpc_url: optional_env("SOLANA_RPC_URL"),
    }
}

fn optional_env(name: &str) -> Option<String> {
    match std::env::var(name) {
        Ok(v) if !v.is_empty() => Some(v),
        _ => None,
    }
}

/// Bail with a clear error if the Dynamic credentials are missing.
pub fn require_dynamic_creds() -> anyhow::Result<&'static Config> {
    let c = get();
    if c.dynamic_api_token.is_empty() || c.dynamic_env_id.is_empty() {
        anyhow::bail!(
            "DYNAMIC_API_TOKEN and DYNAMIC_ENV_ID are required — copy .env.example to .env"
        );
    }
    Ok(c)
}
