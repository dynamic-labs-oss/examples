//! Sign an EIP-191 personal_sign message with a Dynamic EVM server wallet.
//!
//! Examples:
//!
//!   cargo run --bin evm-sign-message -- "Hello, World!"
//!   cargo run --bin evm-sign-message -- "Hello, World!" --address 0xabc...

use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk_evm::DynamicEvmWalletClient;

use rust_server_wallets::{cli, dynamic as factory, walletops};

#[derive(Parser, Debug)]
struct Args {
    /// Message to sign
    message: String,
    /// Use a saved wallet by address (omit to create an ephemeral wallet)
    #[arg(long)]
    address: Option<String>,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();
        let client = factory::authenticated_client().await?;
        let (wp, shares) = walletops::ensure_evm_wallet(&client, args.address.as_deref()).await?;

        let evm = DynamicEvmWalletClient::new(&client);
        println!("\nSigning message...");
        let started = std::time::Instant::now();
        let sig = evm
            .sign_message(&wp, &shares, &args.message)
            .await
            .context("sign message")?;

        println!(
            "\nMessage signed in {:.2}s",
            started.elapsed().as_secs_f64()
        );
        println!("Message: {:?}", args.message);
        println!("Signature: {sig}");
        println!("Signer: {}", wp.account_address);
        Ok(())
    })
}
