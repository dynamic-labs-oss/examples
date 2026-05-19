//! Sign a Solana transaction message using the Dynamic SDK's
//! `run_sign_ed25519` primitive. Builds a 0-lamport self-transfer on
//! devnet, signs the message bytes, attaches the signature to a wire
//! transaction, and prints the raw hex. No broadcast — see
//! `svm-send-transaction` for that.
//!
//! Examples:
//!
//!   cargo run --bin svm-sign-transaction
//!   cargo run --bin svm-sign-transaction -- --address <address>

use std::str::FromStr;

use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk::{run_sign_ed25519, SignOptsEd25519};
#[allow(deprecated)]
use solana_sdk::system_instruction;
use solana_sdk::{
    hash::Hash, instruction::Instruction, message::Message, pubkey::Pubkey, signature::Signature,
    transaction::Transaction,
};

use rust_server_wallets::{cli, config, dynamic as factory, walletops};

#[derive(Parser, Debug)]
struct Args {
    /// Use a saved wallet by address (omit to create an ephemeral wallet)
    #[arg(long)]
    address: Option<String>,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();
        config::require_dynamic_creds()?;

        let client = factory::authenticated_client().await?;
        let (wp, shares) = walletops::ensure_svm_wallet(&client, args.address.as_deref()).await?;
        let from = Pubkey::from_str(&wp.account_address).context("parse Solana address")?;

        // Build a minimal self-transfer (0 lamports) — exercises the same
        // sign path as a real instruction without needing devnet funds.
        // Hash::default() is a placeholder blockhash; for actual broadcast
        // see svm-send-transaction (it fetches a fresh blockhash from the RPC).
        let instruction: Instruction = system_instruction::transfer(&from, &from, 0);
        let message = Message::new_with_blockhash(&[instruction], Some(&from), &Hash::default());
        let message_bytes = message.serialize();

        // Sign via MPC. The server-side request is hardcoded to
        // is_formatted=false; the SDK signs the raw message bytes.
        let share = shares
            .first()
            .ok_or_else(|| anyhow::anyhow!("no key shares"))?
            .clone();

        println!("\nSigning Solana transaction message...");
        let started = std::time::Instant::now();
        let sig_arr: [u8; 64] = run_sign_ed25519(
            &client,
            SignOptsEd25519::new(wp.wallet_id.clone(), message_bytes.clone(), share),
        )
        .await
        .context("run_sign_ed25519")?;
        let signature = Signature::from(sig_arr);

        // Attach the signature into the wire transaction.
        let mut tx = Transaction::new_unsigned(message);
        tx.signatures[0] = signature;

        let wire = bincode::serialize(&tx).context("serialize signed tx")?;

        println!(
            "\nTransaction signed in {:.2}s",
            started.elapsed().as_secs_f64()
        );
        println!("Signature (base58): {}", signature);
        println!("Wire tx (hex): 0x{}", hex::encode(&wire));
        println!("Signer: {}", from);
        println!("\nTo broadcast manually, base64-encode the wire bytes and POST to the RPC's sendTransaction method.");
        Ok(())
    })
}
