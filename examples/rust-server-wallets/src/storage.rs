//! Local JSON wallet store.
//!
//! WARNING: FOR TESTING AND DEVELOPMENT ONLY — NOT FOR PRODUCTION USE.
//!
//! Key shares are stored unencrypted in `.wallets.json`. In production,
//! persist the SDK's `WalletProperties` in your service database and the
//! `Vec<ServerKeyShare>` in a KMS / Vault. The stateless v1 contract makes
//! that split trivial — every signing method takes both as explicit
//! arguments.

use std::path::PathBuf;

use anyhow::Context;
use dynamic_waas_sdk::{ServerKeyShare, ThresholdSignatureScheme, WalletProperties};
use serde::{Deserialize, Serialize};

const WALLET_FILE: &str = ".wallets.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredKeyShare {
    pub key_share_id: String,
    pub secret_share: String,
}

impl From<&ServerKeyShare> for StoredKeyShare {
    fn from(s: &ServerKeyShare) -> Self {
        Self {
            key_share_id: s.key_share_id.clone(),
            secret_share: s.secret_share.clone(),
        }
    }
}

impl StoredKeyShare {
    pub fn to_server(&self) -> ServerKeyShare {
        ServerKeyShare::new(&self.key_share_id, &self.secret_share)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredWallet {
    pub address: String,
    pub wallet_id: String,
    pub chain_name: String, // "EVM" or "SVM"
    #[serde(default)]
    pub threshold_signature_scheme: ThresholdSignatureScheme,
    #[serde(default)]
    pub derivation_path: Option<Vec<u32>>,
    #[serde(default)]
    pub key_shares: Vec<StoredKeyShare>,
    pub created_at: String,
}

impl StoredWallet {
    pub fn to_properties(&self) -> WalletProperties {
        let mut wp = WalletProperties::new(&self.chain_name, &self.wallet_id, &self.address)
            .with_threshold(self.threshold_signature_scheme);
        if let Some(path) = &self.derivation_path {
            wp = wp.with_derivation_path(path.clone());
        }
        wp
    }

    pub fn shares(&self) -> Vec<ServerKeyShare> {
        self.key_shares.iter().map(|k| k.to_server()).collect()
    }
}

fn wallet_path() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(WALLET_FILE)
}

pub fn load() -> anyhow::Result<std::collections::BTreeMap<String, StoredWallet>> {
    let path = wallet_path();
    if !path.exists() {
        return Ok(std::collections::BTreeMap::new());
    }
    let raw = std::fs::read_to_string(&path).context("read wallets file")?;
    match serde_json::from_str(&raw) {
        Ok(map) => Ok(map),
        Err(e) => {
            eprintln!("Warning: failed to parse {}: {e}", path.display());
            Ok(std::collections::BTreeMap::new())
        }
    }
}

pub fn save(wallet: &StoredWallet) -> anyhow::Result<()> {
    let mut wallets = load()?;
    wallets.insert(wallet.address.clone(), wallet.clone());
    write_all(&wallets)
}

pub fn get(address: &str) -> anyhow::Result<Option<StoredWallet>> {
    Ok(load()?.get(address).cloned())
}

pub fn list(chain: Option<&str>) -> anyhow::Result<Vec<StoredWallet>> {
    let wallets = load()?;
    Ok(wallets
        .into_values()
        .filter(|w| match chain {
            Some(c) => w.chain_name.eq_ignore_ascii_case(c),
            None => true,
        })
        .collect())
}

pub fn delete(address: &str) -> anyhow::Result<bool> {
    let mut wallets = load()?;
    if wallets.remove(address).is_none() {
        return Ok(false);
    }
    write_all(&wallets)?;
    Ok(true)
}

fn write_all(wallets: &std::collections::BTreeMap<String, StoredWallet>) -> anyhow::Result<()> {
    let path = wallet_path();
    let data = serde_json::to_string_pretty(wallets)?;
    std::fs::write(&path, data).context("write wallets file")?;
    // 0o600 on Unix to keep the file out of world-readable scopes. Best-
    // effort: ignored on non-Unix; this storage is testing-only anyway.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}
