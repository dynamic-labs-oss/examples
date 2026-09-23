//! Dynamic SDK client factories. Wrap the SDK constructors so individual
//! binaries don't repeat the auth boilerplate.

use anyhow::Context;
use dynamic_waas_sdk::{
    DelegatedWalletClient, DelegatedWalletClientOpts, DynamicWalletClient, DynamicWalletClientOpts,
};

use crate::config;

/// Build an authenticated top-level Dynamic client. The chain-specific
/// wrappers (`DynamicEvmWalletClient`, `DynamicSvmWalletClient`) borrow
/// this inner client by reference.
pub async fn authenticated_client() -> anyhow::Result<DynamicWalletClient> {
    let c = config::require_dynamic_creds()?;

    let mut opts = DynamicWalletClientOpts::new(&c.dynamic_env_id);
    if let Some(url) = &c.dynamic_base_api_url {
        opts = opts.base_api_url(url);
    }

    let mut client = DynamicWalletClient::new(opts).context("build Dynamic client")?;
    client
        .authenticate_api_token(&c.dynamic_api_token)
        .await
        .context("authenticate Dynamic API token")?;
    Ok(client)
}

/// Build a delegated client. Unlike `authenticated_client`, this auth
/// scheme is per-wallet — pass the wallet-scoped API key delivered via
/// webhook.
pub fn delegated_client(wallet_api_key: &str) -> anyhow::Result<DelegatedWalletClient> {
    let c = config::require_dynamic_creds()?;

    let mut opts = DelegatedWalletClientOpts::new(&c.dynamic_env_id, wallet_api_key);
    if let Some(url) = &c.dynamic_base_api_url {
        opts = opts.base_api_url(url);
    }

    DelegatedWalletClient::new(opts).context("build delegated client")
}
