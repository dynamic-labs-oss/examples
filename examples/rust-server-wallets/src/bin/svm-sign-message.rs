//! Sign a UTF-8 message with a Dynamic Solana server wallet. Returns a
//! base58-encoded 64-byte Ed25519 signature.

use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk_svm::DynamicSvmWalletClient;

use rust_server_wallets::{cli, dynamic as factory, walletops};

#[derive(Parser, Debug)]
struct Args {
    message: String,
    #[arg(long)]
    address: Option<String>,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();
        let client = factory::authenticated_client().await?;
        let (wp, shares) = walletops::ensure_svm_wallet(&client, args.address.as_deref()).await?;

        let svm = DynamicSvmWalletClient::new(&client);
        println!("\nSigning Solana message...");
        let started = std::time::Instant::now();
        let sig = svm
            .sign_message(&wp, &shares, &args.message)
            .await
            .context("sign message")?;

        println!(
            "\nMessage signed in {:.2}s",
            started.elapsed().as_secs_f64()
        );
        println!("Message: {:?}", args.message);
        println!("Signature (base58): {sig}");
        println!("Signer: {}", wp.account_address);
        Ok(())
    })
}
