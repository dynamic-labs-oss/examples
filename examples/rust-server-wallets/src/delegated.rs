//! Delegated `wallet.json` loader. Same schema as the Python and Go
//! examples so credentials are interchangeable.

use std::path::Path;

use anyhow::Context;
use dynamic_waas_sdk::ServerKeyShare;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegatedWalletFile {
    /// Either "EVM" or "SVM". Optional — defaults to EVM.
    #[serde(default = "default_chain")]
    pub chain: String,

    pub address: String,
    #[serde(rename = "walletId")]
    pub wallet_id: String,
    #[serde(rename = "walletApiKey")]
    pub wallet_api_key: String,
    #[serde(rename = "delegatedShare")]
    pub delegated_share: DelegatedShareJson,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegatedShareJson {
    #[serde(default, rename = "keyShareId")]
    pub key_share_id: String,
    #[serde(rename = "secretShare")]
    pub secret_share: String,
}

fn default_chain() -> String {
    "EVM".into()
}

impl DelegatedWalletFile {
    pub fn load(path: &Path) -> anyhow::Result<Self> {
        let raw =
            std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
        let parsed: DelegatedWalletFile =
            serde_json::from_str(&raw).with_context(|| format!("parse {}", path.display()))?;
        if parsed.wallet_id.is_empty()
            || parsed.wallet_api_key.is_empty()
            || parsed.delegated_share.secret_share.is_empty()
        {
            anyhow::bail!(
                "{} missing required field(s): walletId, walletApiKey, delegatedShare.secretShare",
                path.display(),
            );
        }
        Ok(parsed)
    }

    pub fn share(&self) -> ServerKeyShare {
        ServerKeyShare::new(
            &self.delegated_share.key_share_id,
            &self.delegated_share.secret_share,
        )
    }
}
