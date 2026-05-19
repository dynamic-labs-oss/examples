//! Create, list, and delete Dynamic Solana (SVM) server wallets.
//!
//! Examples:
//!
//!   cargo run --bin svm-wallet -- --create
//!   cargo run --bin svm-wallet -- --create --save
//!   cargo run --bin svm-wallet -- --create --save --backup --password myPassword
//!   cargo run --bin svm-wallet -- --list
//!   cargo run --bin svm-wallet -- --delete <address>

use anyhow::Context;
use chrono::Utc;
use clap::Parser;
use dynamic_waas_sdk::ThresholdSignatureScheme;
use dynamic_waas_sdk_svm::DynamicSvmWalletClient;

use rust_server_wallets::{
    cli, dynamic as factory, storage,
    storage::{StoredKeyShare, StoredWallet},
};

#[derive(Parser, Debug)]
#[command(about = "Manage Dynamic Solana server wallets")]
struct Args {
    #[arg(long)]
    create: bool,
    #[arg(long)]
    list: bool,
    #[arg(long)]
    delete: Option<String>,
    #[arg(long, requires = "create")]
    save: bool,
    #[arg(long, requires = "create")]
    backup: bool,
    #[arg(long)]
    password: Option<String>,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();
        if !args.create && !args.list && args.delete.is_none() {
            anyhow::bail!("specify --create, --list, or --delete <address>");
        }
        if args.list {
            return run_list();
        }
        if let Some(addr) = args.delete {
            return run_delete(&addr);
        }
        run_create(args).await
    })
}

async fn run_create(args: Args) -> anyhow::Result<()> {
    if args.backup && args.password.is_none() {
        anyhow::bail!("--backup requires --password");
    }
    let client = factory::authenticated_client().await?;
    let svm = DynamicSvmWalletClient::new(&client);

    println!("Creating Solana server wallet...");
    let started = std::time::Instant::now();
    let (wp, shares) = svm
        .create_wallet_account(
            ThresholdSignatureScheme::default(),
            args.password.clone(),
            args.backup,
        )
        .await
        .context("create wallet")?;

    println!(
        "Solana wallet created in {:.2}s",
        started.elapsed().as_secs_f64()
    );
    println!("Address: {}", wp.account_address);
    println!("Wallet ID: {}", wp.wallet_id);
    if args.backup {
        println!("Key share backed up to Dynamic");
    }

    if !args.save {
        println!("Tip: Add --save to persist this wallet for reuse");
        return Ok(());
    }

    let stored = StoredWallet {
        address: wp.account_address.clone(),
        wallet_id: wp.wallet_id.clone(),
        chain_name: wp.chain_name.clone(),
        threshold_signature_scheme: wp.threshold_signature_scheme,
        derivation_path: wp.derivation_path.clone(),
        key_shares: if args.backup {
            Vec::new()
        } else {
            shares.iter().map(StoredKeyShare::from).collect()
        },
        created_at: Utc::now().to_rfc3339(),
    };
    storage::save(&stored)?;
    println!("Wallet saved to .wallets.json");
    Ok(())
}

fn run_list() -> anyhow::Result<()> {
    let wallets = storage::list(Some("SVM"))?;
    if wallets.is_empty() {
        println!("No saved Solana wallets found.");
        return Ok(());
    }
    println!("Saved Solana wallets ({}):\n", wallets.len());
    for (i, w) in wallets.iter().enumerate() {
        println!("{}. {}", i + 1, w.address);
        println!("   Wallet ID: {}", w.wallet_id);
        let loc = if w.key_shares.is_empty() {
            "backed up to Dynamic"
        } else {
            "stored locally"
        };
        println!("   Key shares: {loc}");
        println!("   Created: {}\n", w.created_at);
    }
    Ok(())
}

fn run_delete(addr: &str) -> anyhow::Result<()> {
    if !storage::delete(addr)? {
        anyhow::bail!("wallet not found: {addr}");
    }
    println!("Wallet deleted successfully");
    Ok(())
}
