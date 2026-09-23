//! Sign + broadcast an EVM transaction. Fetches a live nonce + gas price
//! from the configured `EVM_RPC_URL`, signs the tx via Dynamic's MPC
//! ceremony (`run_sign_ecdsa`), and submits the raw bytes to the same
//! RPC endpoint.
//!
//! Examples:
//!
//!   cargo run --bin evm-send-transaction
//!   cargo run --bin evm-send-transaction -- --address 0xabc...

use alloy::consensus::{SignableTransaction, TxEnvelope, TxLegacy};
use alloy::eips::eip2718::Encodable2718;
use alloy::primitives::{Address, PrimitiveSignature, TxKind, U256};
use alloy::providers::{Provider, ProviderBuilder};
use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk::{mpc_config::EVM_DERIVATION_PATH, run_sign_ecdsa, SignOpts};
use std::str::FromStr;

use rust_server_wallets::{cli, config, dynamic as factory, utils, walletops};

#[derive(Parser, Debug)]
struct Args {
    /// Use a saved wallet by address (omit to create an ephemeral wallet)
    #[arg(long)]
    address: Option<String>,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();
        let cfg = config::require_dynamic_creds()?;
        let rpc_url = cfg
            .evm_rpc_url
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("EVM_RPC_URL is required — set it in .env"))?;

        let client = factory::authenticated_client().await?;
        let (wp, shares) = walletops::ensure_evm_wallet(&client, args.address.as_deref()).await?;
        let from = Address::from_str(&wp.account_address).context("parse wallet address")?;

        // Build an HTTP provider against the configured RPC.
        let provider =
            ProviderBuilder::new().on_http(rpc_url.parse().context("parse EVM_RPC_URL")?);

        // Pre-flight: live nonce + suggested gas price so the tx has a chance
        // of landing.
        let nonce = provider
            .get_transaction_count(from)
            .await
            .context("fetch nonce")?;
        let gas_price = provider.get_gas_price().await.context("fetch gas price")?;

        let tx = TxLegacy {
            chain_id: Some(config::BASE_SEPOLIA_CHAIN_ID),
            nonce,
            gas_price,
            gas_limit: 21_000,
            to: TxKind::Call(Address::from([0u8; 20])),
            value: U256::ZERO,
            input: Default::default(),
        };

        let signing_hash = tx.signature_hash();

        // Sign via MPC.
        let share = shares
            .first()
            .ok_or_else(|| anyhow::anyhow!("no key shares"))?
            .clone();
        let derivation_path = wp
            .derivation_path
            .clone()
            .unwrap_or_else(|| EVM_DERIVATION_PATH.to_vec());
        let hash_bytes: [u8; 32] = signing_hash.into();

        println!("\nSigning EVM transaction...");
        let started = std::time::Instant::now();
        let sig = run_sign_ecdsa(
            &client,
            SignOpts::new(
                wp.wallet_id.clone(),
                hash_bytes,
                hex::encode(hash_bytes),
                /* is_formatted */ true,
                share,
                derivation_path,
            ),
        )
        .await
        .context("run_sign_ecdsa")?;

        let primitive = PrimitiveSignature::new(
            U256::from_be_slice(&sig.r),
            U256::from_be_slice(&sig.s),
            /* parity */ sig.v == 28,
        );
        let signed = tx.into_signed(primitive);
        let envelope: TxEnvelope = signed.into();
        let raw = envelope.encoded_2718();

        println!("Broadcasting via {rpc_url}...");
        let pending = provider
            .send_raw_transaction(&raw)
            .await
            .context("eth_sendRawTransaction")?;
        let hash = *pending.tx_hash();

        println!(
            "\nTransaction sent in {:.2}s",
            started.elapsed().as_secs_f64()
        );
        println!("Hash: {hash}");
        println!("Explorer: {}", utils::evm_tx_link(&hash.to_string()));
        println!("Wallet: {}", from);
        Ok(())
    })
}
