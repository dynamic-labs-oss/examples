//! Unwrap an encrypted delegation webhook payload using the customer's RSA
//! private key.
//!
//! Modes:
//!
//!   - Demo (no args): prints the API surface — useful for documentation.
//!   - Live: pass --rsa-key <path> and --payload <path> to actually decrypt.
//!
//! The payload file may be either the full `wallet.delegation.created`
//! webhook body or just the inner `data` object.

use std::path::PathBuf;

use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk::{decrypt_delegated_webhook_data, EncryptedDelegatedPayload};
use serde::Deserialize;

use rust_server_wallets::cli;

#[derive(Parser, Debug)]
struct Args {
    /// Path to your RSA private key (PEM)
    #[arg(long)]
    rsa_key: Option<PathBuf>,
    /// Path to the encrypted webhook payload JSON
    #[arg(long)]
    payload: Option<PathBuf>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EnvelopePair {
    chain: Option<String>,
    wallet_id: Option<String>,
    public_key: Option<String>,
    encrypted_delegated_share: EncryptedDelegatedPayload,
    encrypted_wallet_api_key: EncryptedDelegatedPayload,
}

#[derive(Debug, Deserialize)]
struct WebhookPayload {
    #[serde(default)]
    data: Option<EnvelopePair>,
    #[serde(flatten)]
    inline: Option<EnvelopePair>,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();

        match (args.rsa_key.as_ref(), args.payload.as_ref()) {
            (None, None) => {
                print_demo();
                Ok(())
            }
            (Some(_), None) | (None, Some(_)) => {
                anyhow::bail!("both --rsa-key and --payload are required for live decryption");
            }
            (Some(rsa_key), Some(payload)) => run_live(rsa_key, payload),
        }
    })
}

fn run_live(rsa_key: &std::path::Path, payload: &std::path::Path) -> anyhow::Result<()> {
    let pem = std::fs::read_to_string(rsa_key).context("read RSA key")?;
    let raw = std::fs::read_to_string(payload).context("read payload")?;
    let parsed: WebhookPayload = serde_json::from_str(&raw).context("parse webhook payload")?;
    let env = parsed
        .data
        .or(parsed.inline)
        .context("payload must contain either a top-level envelope or a `data` object")?;

    let decrypted = decrypt_delegated_webhook_data(
        &pem,
        &env.encrypted_delegated_share,
        &env.encrypted_wallet_api_key,
    )
    .context("decrypt webhook")?;

    println!("Decryption succeeded.");
    if let Some(c) = env.chain {
        println!("Chain:        {c}");
    }
    if let Some(w) = env.wallet_id {
        println!("Wallet ID:    {w}");
    }
    if let Some(p) = env.public_key {
        println!("Public key:   {p}");
    }
    println!("API key:      {}", mask(&decrypted.wallet_api_key));
    println!("Share keygen: {}", decrypted.server_key_share.key_share_id);
    println!();
    println!("Persist these credentials to your KMS / database (never plaintext at rest)");
    println!("and feed them into delegated-sign-message via wallet.json.");
    Ok(())
}

fn mask(s: &str) -> String {
    if s.len() <= 8 {
        return "***".to_string();
    }
    let (head, _) = s.split_at(4);
    let tail_start = s.len() - 4;
    format!("{}...{}", head, &s[tail_start..])
}

fn print_demo() {
    println!("Delegated Webhook Decryption — API Demo");
    println!("=======================================\n");
    println!("decrypt_delegated_webhook_data(rsa_pem, &encrypted_share, &encrypted_api_key)");
    println!();
    println!("Inputs:");
    println!("  - rsa_pem:           &str — your RSA private key (PEM)");
    println!("  - encrypted_share:   &EncryptedDelegatedPayload (from webhook payload)");
    println!("  - encrypted_api_key: &EncryptedDelegatedPayload (from webhook payload)");
    println!();
    println!("Returns DecryptedWebhookData with:");
    println!("  - server_key_share: ServerKeyShare (pass to delegated sign methods)");
    println!("  - wallet_api_key:   String (use to build a DelegatedWalletClient)");
    println!();
    println!("Security:");
    println!("  - Store decrypted credentials encrypted at rest (KMS / Vault).");
    println!("  - Never log raw secrets — Debug impl is redacted, but println!() isn't.");
    println!("  - The RSA private key must remain server-side only.");
    println!();
    println!("Run with --rsa-key <path> --payload <path> to actually decrypt a payload.");
}
