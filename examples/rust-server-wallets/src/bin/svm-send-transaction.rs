//! Sign + broadcast a Solana transaction. Fetches a fresh blockhash from
//! `SOLANA_RPC_URL`, signs via Dynamic's MPC ceremony
//! (`run_sign_ed25519`), assembles the wire transaction, and submits it
//! via `sendTransaction`.
//!
//! Sponsored mode (`--sponsored`) isn't supported here — the Rust SDK
//! 0.0.3 doesn't expose `sponsor_transaction`.
//!
//! Examples:
//!
//!   cargo run --bin svm-send-transaction
//!   cargo run --bin svm-send-transaction -- --address <address>

use std::str::FromStr;

use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk::{run_sign_ed25519, SignOptsEd25519};
use solana_client::nonblocking::rpc_client::RpcClient;
#[allow(deprecated)]
use solana_sdk::system_instruction;
use solana_sdk::{
    commitment_config::CommitmentConfig, instruction::Instruction, message::Message,
    pubkey::Pubkey, signature::Signature, transaction::Transaction,
};

use rust_server_wallets::{cli, config, dynamic as factory, utils, walletops};

#[derive(Parser, Debug)]
struct Args {
    /// Use a saved wallet by address (omit to create an ephemeral wallet)
    #[arg(long)]
    address: Option<String>,
    /// Use Dynamic gas sponsorship (not supported in Rust SDK 0.0.3)
    #[arg(long)]
    sponsored: bool,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();
        let cfg = config::require_dynamic_creds()?;
        let rpc_url = cfg
            .solana_rpc_url
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("SOLANA_RPC_URL is required — set it in .env"))?;
        if args.sponsored {
            anyhow::bail!(
                "--sponsored is not supported by dynamic-waas-sdk-svm 0.0.3 — \
                 sponsor_transaction is not yet exposed in this SDK version."
            );
        }

        let client = factory::authenticated_client().await?;
        let (wp, shares) = walletops::ensure_svm_wallet(&client, args.address.as_deref()).await?;
        let from = Pubkey::from_str(&wp.account_address).context("parse Solana address")?;

        // Fetch a fresh blockhash so the cluster will accept the tx.
        let rpc =
            RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::finalized());
        let recent_blockhash = rpc
            .get_latest_blockhash()
            .await
            .context("fetch latest blockhash")?;

        let instruction: Instruction = system_instruction::transfer(&from, &from, 0);
        let message = Message::new_with_blockhash(&[instruction], Some(&from), &recent_blockhash);
        let message_bytes = message.serialize();

        let share = shares
            .first()
            .ok_or_else(|| anyhow::anyhow!("no key shares"))?
            .clone();

        println!("\nSending Solana transaction...");
        let started = std::time::Instant::now();
        let sig_arr: [u8; 64] = run_sign_ed25519(
            &client,
            SignOptsEd25519::new(wp.wallet_id.clone(), message_bytes.clone(), share),
        )
        .await
        .context("run_sign_ed25519")?;
        let signature = Signature::from(sig_arr);

        let mut tx = Transaction::new_unsigned(message);
        tx.signatures[0] = signature;

        let sig = rpc.send_transaction(&tx).await.context("sendTransaction")?;

        println!(
            "\nTransaction sent in {:.2}s",
            started.elapsed().as_secs_f64()
        );
        println!("Signature: {sig}");
        println!("Explorer: {}", utils::solana_tx_link(&sig.to_string()));
        println!("Wallet: {}", from);
        Ok(())
    })
}
