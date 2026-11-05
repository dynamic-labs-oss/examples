//! Sign an EIP-712 typed-data structure using the Dynamic SDK's low-level
//! `run_sign_ecdsa` orchestrator (the high-level
//! `DynamicEvmWalletClient::sign_typed_data` wrapper hasn't shipped yet in
//! 0.0.3, but the underlying primitive is public).
//!
//! Examples:
//!
//!   cargo run --bin evm-sign-typed-data
//!   cargo run --bin evm-sign-typed-data -- --address 0xabc...

use alloy::dyn_abi::TypedData;
use alloy::primitives::{Address, B256, U256};
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

        // Build the typed-data structure. Same shape the Go and Python
        // examples use: a `Mail` struct with chainId=1.
        let typed_data: TypedData = serde_json::from_value(serde_json::json!({
            "types": {
                "EIP712Domain": [
                    { "name": "name",    "type": "string"  },
                    { "name": "version", "type": "string"  },
                    { "name": "chainId", "type": "uint256" }
                ],
                "Mail": [
                    { "name": "from",     "type": "address" },
                    { "name": "to",       "type": "address" },
                    { "name": "contents", "type": "string"  }
                ]
            },
            "primaryType": "Mail",
            "domain": {
                "name":    "DynamicRustSDKExample",
                "version": "1",
                "chainId": 1
            },
            "message": {
                "from":     from.to_checksum(None),
                "to":       "0x0000000000000000000000000000000000000001",
                "contents": "hello typed data"
            }
        }))
        .context("build typed data")?;

        // 1. Compute the EIP-712 digest locally:
        //    keccak256("\x19\x01" || domainSeparator || messageHash)
        let digest: B256 = typed_data
            .eip712_signing_hash()
            .context("compute EIP-712 signing hash")?;

        // 2. Sign the digest. is_formatted=true tells the server "this is
        //    already the final digest — don't apply EIP-191 wrapping".
        let share = shares
            .first()
            .ok_or_else(|| anyhow::anyhow!("no key shares"))?
            .clone();
        let derivation_path = wp
            .derivation_path
            .clone()
            .unwrap_or_else(|| EVM_DERIVATION_PATH.to_vec());
        let digest_bytes: [u8; 32] = digest.into();

        println!("\nSigning EIP-712 typed data...");
        let started = std::time::Instant::now();
        let sig = run_sign_ecdsa(
            &client,
            SignOpts::new(
                wp.wallet_id.clone(),
                digest_bytes,
                hex::encode(digest_bytes),
                /* is_formatted */ true,
                share,
                derivation_path,
            ),
        )
        .await
        .context("run_sign_ecdsa")?;

        // 3. Serialise as 0x-prefixed r||s||v (65 bytes; v ∈ {27, 28}).
        let mut bytes = Vec::with_capacity(65);
        bytes.extend_from_slice(&sig.r);
        bytes.extend_from_slice(&sig.s);
        bytes.push(sig.v);
        let signature_hex = format!("0x{}", hex::encode(&bytes));

        // Sanity check the signature recovers to the wallet address.
        let primitive = alloy::primitives::PrimitiveSignature::new(
            U256::from_be_slice(&sig.r),
            U256::from_be_slice(&sig.s),
            /* parity */ sig.v == 28,
        );
        let recovered = primitive
            .recover_address_from_prehash(&digest)
            .context("recover signer from typed-data digest")?;

        println!(
            "\nTyped data signed in {:.2}s",
            started.elapsed().as_secs_f64()
        );
        println!("Primary type: {}", typed_data.primary_type);
        println!("Signature: {signature_hex}");
        println!("Signer: {}", wp.account_address);
        if recovered.eq(&from) {
            println!("Recovered signer matches wallet address ✓");
        } else {
            anyhow::bail!("recovered signer {recovered} does NOT match wallet address {from}");
        }
        Ok(())
    })
}
