//! Sign a message via a delegated wallet. Credentials come from a
//! `wallet.json` file produced by your delegation webhook handler.
//!
//! Example:
//!
//!   cargo run --bin delegated-sign-message -- \
//!       "Hello, World!" \
//!       --wallet src/bin/delegated-sign-message.wallet.json

use std::path::PathBuf;

use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk::WalletProperties;
use dynamic_waas_sdk_evm::DelegatedEvmWalletClient;
use dynamic_waas_sdk_svm::DelegatedSvmWalletClient;

use rust_server_wallets::{cli, delegated::DelegatedWalletFile, dynamic as factory};

#[derive(Parser, Debug)]
struct Args {
    /// Message to sign
    message: String,
    /// Path to wallet.json (defaults to ./wallet.json next to this binary)
    #[arg(long, default_value = "wallet.json")]
    wallet: PathBuf,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();
        let file = DelegatedWalletFile::load(&args.wallet)?;
        println!("Chain: {}", file.chain);
        println!("Wallet ID: {}", file.wallet_id);
        println!("Address: {}", file.address);

        // Per-wallet delegated client — auth is the wallet API key delivered
        // via webhook.
        let delegated = factory::delegated_client(&file.wallet_api_key)?;
        let share = file.share();

        // Build a WalletProperties from the wallet.json identity fields.
        // For delegated flows, the customer always has wallet_id + address;
        // chain comes from the same payload.
        let wp = WalletProperties::new(&file.chain, &file.wallet_id, &file.address);

        let started = std::time::Instant::now();
        let signature = match file.chain.as_str() {
            "EVM" => DelegatedEvmWalletClient::new(&delegated)
                .sign_message(&wp, std::slice::from_ref(&share), &args.message)
                .await
                .context("delegated EVM sign_message")?,
            "SVM" => DelegatedSvmWalletClient::new(&delegated)
                .sign_message(&wp, std::slice::from_ref(&share), &args.message)
                .await
                .context("delegated SVM sign_message")?,
            other => anyhow::bail!("unsupported chain in wallet.json: {other:?} (use EVM or SVM)"),
        };

        println!(
            "\nMessage signed in {:.2}s",
            started.elapsed().as_secs_f64()
        );
        println!("Message: {:?}", args.message);
        println!("Signature: {signature}");
        Ok(())
    })
}
