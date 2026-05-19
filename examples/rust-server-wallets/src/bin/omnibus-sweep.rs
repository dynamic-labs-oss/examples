//! End-to-end omnibus demo: create one "omnibus" wallet plus N customer
//! wallets, then sign a message from each customer wallet to demonstrate
//! throughput at scale.
//!
//! This demo signs an auth message per customer wallet rather than
//! broadcasting a real on-chain sweep — upgrading to ERC-20 transfers
//! via `run_sign_ecdsa` + `alloy` is a follow-up. The shape (parallel
//! wallet creation, parallel signing) is what matters for the
//! throughput demonstration.
//!
//! Examples:
//!
//!   cargo run --bin omnibus-sweep
//!   cargo run --bin omnibus-sweep -- --wallets 20

use std::time::Instant;

use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk::ThresholdSignatureScheme;
use dynamic_waas_sdk_evm::DynamicEvmWalletClient;
use futures::stream::{self, StreamExt};

use rust_server_wallets::{cli, config, dynamic as factory, utils};

#[derive(Parser, Debug)]
struct Args {
    /// Number of customer wallets to create
    #[arg(long, default_value_t = 10)]
    wallets: usize,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();
        if args.wallets == 0 {
            anyhow::bail!("--wallets must be positive");
        }

        let client = factory::authenticated_client().await?;
        let evm = DynamicEvmWalletClient::new(&client);

        println!("Dynamic Server Wallets Demo — Omnibus Sweep");
        println!("{}", "=".repeat(60));
        println!(
            "Configuration: {} wallets, chain id {}",
            args.wallets,
            config::BASE_SEPOLIA_CHAIN_ID
        );
        println!("{}", "=".repeat(60));

        println!("\nCreating omnibus wallet...");
        let (omnibus_wp, _omnibus_shares) = evm
            .create_wallet_account(ThresholdSignatureScheme::default(), None, false)
            .await
            .context("create omnibus wallet")?;
        println!(
            "Omnibus wallet: {}\n",
            utils::format_address(&omnibus_wp.account_address)
        );

        println!("Creating {} customer wallets...", args.wallets);
        let customers = stream::iter(0..args.wallets)
            .map(|i| {
                let evm = DynamicEvmWalletClient::new(&client);
                async move {
                    let result = evm
                        .create_wallet_account(ThresholdSignatureScheme::default(), None, false)
                        .await;
                    match result {
                        Ok((wp, shares)) => {
                            println!(
                                "  customer wallet {} created: {}",
                                i + 1,
                                utils::format_address(&wp.account_address)
                            );
                            Some((wp, shares))
                        }
                        Err(e) => {
                            eprintln!("  customer wallet {} failed: {e}", i + 1);
                            None
                        }
                    }
                }
            })
            .buffer_unordered(config::WALLET_CREATION_CONCURRENCY)
            .filter_map(|w| async move { w })
            .collect::<Vec<_>>()
            .await;
        println!(
            "Created {}/{} customer wallets\n",
            customers.len(),
            args.wallets
        );

        if customers.is_empty() {
            anyhow::bail!("no customer wallets were created");
        }

        println!("Signing one auth message per customer wallet (sweep stand-in)...",);
        let started = Instant::now();
        let signed = stream::iter(customers.iter().enumerate())
            .map(|(i, (wp, shares))| {
                let evm = DynamicEvmWalletClient::new(&client);
                let omnibus_addr = omnibus_wp.account_address.clone();
                async move {
                    let message = format!("sweep::customer_{}::to::{omnibus_addr}", i + 1);
                    match evm.sign_message(wp, shares, &message).await {
                        Ok(sig) => {
                            println!("  customer {} signed: {}", i + 1, &sig[..sig.len().min(20)]);
                            true
                        }
                        Err(e) => {
                            eprintln!("  customer {} sign failed: {e}", i + 1);
                            false
                        }
                    }
                }
            })
            .buffer_unordered(config::TRANSACTION_CONCURRENCY)
            .filter(|ok| {
                let ok = *ok;
                async move { ok }
            })
            .count()
            .await;

        println!("{}", "=".repeat(60));
        println!("Demo completed in {:.2}s", started.elapsed().as_secs_f64());
        println!(
            "Omnibus wallet: {}  ({})",
            omnibus_wp.account_address,
            utils::evm_address_link(&omnibus_wp.account_address)
        );
        println!("Sweep messages signed: {signed}");
        println!(
            "Upgrade path: swap the sign_message call above for a real ERC-20 transfer \
             via run_sign_ecdsa + alloy to complete the sweep on-chain."
        );
        Ok(())
    })
}
