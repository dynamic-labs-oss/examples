//! Shared "load existing wallet or create a fresh ephemeral one" helpers.
//! Mirrors `lib/wallet_helpers.py` in the Python example.

use anyhow::Context;
use dynamic_waas_sdk::{
    DynamicWalletClient, ServerKeyShare, ThresholdSignatureScheme, WalletProperties,
};
use dynamic_waas_sdk_evm::DynamicEvmWalletClient;
use dynamic_waas_sdk_svm::DynamicSvmWalletClient;

use crate::storage;

/// EVM: returns (wallet metadata, key shares). If `address` is supplied,
/// loads from local storage; otherwise creates a new ephemeral wallet.
pub async fn ensure_evm_wallet(
    client: &DynamicWalletClient,
    address: Option<&str>,
) -> anyhow::Result<(WalletProperties, Vec<ServerKeyShare>)> {
    if let Some(addr) = address {
        return load_evm_from_storage(addr);
    }
    let evm = DynamicEvmWalletClient::new(client);
    println!("Creating new ephemeral EVM wallet...");
    let (wp, shares) = evm
        .create_wallet_account(ThresholdSignatureScheme::default(), None, false)
        .await
        .context("create EVM wallet")?;
    println!("Wallet created: {}", wp.account_address);
    Ok((wp, shares))
}

/// SVM analogue of `ensure_evm_wallet`.
pub async fn ensure_svm_wallet(
    client: &DynamicWalletClient,
    address: Option<&str>,
) -> anyhow::Result<(WalletProperties, Vec<ServerKeyShare>)> {
    if let Some(addr) = address {
        return load_svm_from_storage(addr);
    }
    let svm = DynamicSvmWalletClient::new(client);
    println!("Creating new ephemeral SVM wallet...");
    let (wp, shares) = svm
        .create_wallet_account(ThresholdSignatureScheme::default(), None, false)
        .await
        .context("create SVM wallet")?;
    println!("Wallet created: {}", wp.account_address);
    Ok((wp, shares))
}

fn load_evm_from_storage(address: &str) -> anyhow::Result<(WalletProperties, Vec<ServerKeyShare>)> {
    let stored = storage::get(address)?
        .with_context(|| format!("wallet not found: {address} (run `evm-wallet --list`)"))?;
    if !stored.chain_name.eq_ignore_ascii_case("EVM") {
        anyhow::bail!(
            "wallet {address} is on chain {}, expected EVM",
            stored.chain_name
        );
    }
    if stored.key_shares.is_empty() {
        anyhow::bail!(
            "wallet {address} has no locally-stored key shares — recovery is not yet \
             supported by Rust SDK 0.0.3 (see evm-recover-key-shares for status)"
        );
    }
    Ok((stored.to_properties(), stored.shares()))
}

fn load_svm_from_storage(address: &str) -> anyhow::Result<(WalletProperties, Vec<ServerKeyShare>)> {
    let stored = storage::get(address)?
        .with_context(|| format!("wallet not found: {address} (run `svm-wallet --list`)"))?;
    if !stored.chain_name.eq_ignore_ascii_case("SVM") {
        anyhow::bail!(
            "wallet {address} is on chain {}, expected SVM",
            stored.chain_name
        );
    }
    if stored.key_shares.is_empty() {
        anyhow::bail!(
            "wallet {address} has no locally-stored key shares — recovery is not yet \
             supported by Rust SDK 0.0.3"
        );
    }
    Ok((stored.to_properties(), stored.shares()))
}
