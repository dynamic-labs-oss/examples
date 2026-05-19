//! Sign a legacy EVM transaction using the Dynamic SDK's `run_sign_ecdsa`
//! primitive. Returns the raw signed transaction hex — no broadcast.
//! For broadcasting, see `evm-send-transaction`.
//!
//! Examples:
//!
//!   cargo run --bin evm-sign-transaction
//!   cargo run --bin evm-sign-transaction -- --address 0xabc...

use alloy::consensus::{SignableTransaction, TxEnvelope, TxLegacy};
use alloy::eips::eip2718::Encodable2718;
use alloy::primitives::{Address, PrimitiveSignature, TxKind, U256};
use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk::{mpc_config::EVM_DERIVATION_PATH, run_sign_ecdsa, SignOpts};
use std::str::FromStr;

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
        let (wp, shares) = walletops::ensure_evm_wallet(&client, args.address.as_deref()).await?;
        let from = Address::from_str(&wp.account_address).context("parse wallet address")?;

        // Example legacy transaction on Base Sepolia. In production, fetch
        // a live nonce + gas price from an RPC provider before signing —
        // see `evm-send-transaction` for that flow.
        let tx = TxLegacy {
            chain_id: Some(config::BASE_SEPOLIA_CHAIN_ID),
            nonce: 0,
            gas_price: 1_000_000_000, // 1 gwei
            gas_limit: 21_000,
            to: TxKind::Call(Address::from([0u8; 20])),
            value: U256::ZERO,
            input: Default::default(),
        };

        // 1. Compute the signing hash (keccak256 of RLP-encoded unsigned tx).
        let signing_hash = tx.signature_hash();

        // 2. Sign via MPC.
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

        // 3. Attach the signature and serialise as a signed wire tx.
        let primitive = PrimitiveSignature::new(
            U256::from_be_slice(&sig.r),
            U256::from_be_slice(&sig.s),
            /* parity */ sig.v == 28,
        );
        // Sanity: recovered signer must match the wallet address.
        let recovered = primitive
            .recover_address_from_prehash(&signing_hash)
            .context("recover signer from tx signing hash")?;
        if recovered != from {
            anyhow::bail!("recovered signer {recovered} does NOT match wallet address {from}");
        }

        let signed = tx.into_signed(primitive);
        let tx_hash = *signed.hash();
        // Encodable2718 is implemented on the envelope, not on Signed<T>.
        let envelope: TxEnvelope = signed.into();
        let raw = envelope.encoded_2718();

        println!(
            "\nTransaction signed in {:.2}s",
            started.elapsed().as_secs_f64()
        );
        println!("Chain: Base Sepolia ({})", config::BASE_SEPOLIA_CHAIN_ID);
        println!("Tx hash (pre-broadcast): {}", tx_hash);
        println!("Raw TX: 0x{}", hex::encode(&raw));
        println!("Signer: {}", from);
        println!("\nTo broadcast manually:");
        println!(
            "  curl -X POST $EVM_RPC_URL -d '{{\"jsonrpc\":\"2.0\",\"method\":\"eth_sendRawTransaction\",\"params\":[\"0x{}\"],\"id\":1}}'",
            hex::encode(&raw)
        );
        Ok(())
    })
}
