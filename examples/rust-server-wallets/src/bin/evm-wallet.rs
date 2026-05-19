//! Create, list, and delete Dynamic EVM server wallets.
//!
//! Examples:
//!
//!   cargo run --bin evm-wallet -- --create
//!   cargo run --bin evm-wallet -- --create --save
//!   cargo run --bin evm-wallet -- --create --save --backup --password mySecretPassword
//!   cargo run --bin evm-wallet -- --list
//!   cargo run --bin evm-wallet -- --delete 0x123...

use anyhow::Context;
use chrono::Utc;
use clap::Parser;
use dynamic_waas_sdk::ThresholdSignatureScheme;
use dynamic_waas_sdk_evm::DynamicEvmWalletClient;

use rust_server_wallets::{
    cli, dynamic as factory, storage,
    storage::{StoredKeyShare, StoredWallet},
};

#[derive(Parser, Debug)]
#[command(about = "Manage Dynamic EVM server wallets")]
struct Args {
    /// Create a new wallet
    #[arg(long)]
    create: bool,
    /// List saved EVM wallets
    #[arg(long)]
    list: bool,
    /// Delete a saved wallet by address
    #[arg(long)]
    delete: Option<String>,
    /// Persist the wallet to .wallets.json
    #[arg(long, requires = "create")]
    save: bool,
    /// Back up the share to Dynamic (requires --password to later sign)
    #[arg(long, requires = "create")]
    backup: bool,
    /// Password used to encrypt the backup (required with --backup)
    #[arg(long)]
    password: Option<String>,
    /// Threshold scheme (Rust SDK 0.0.3 supports 2 only)
    #[arg(long, default_value_t = 2)]
    threshold: u8,
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
    if args.threshold != 2 {
        println!(
            "Note: Rust SDK 0.0.3 only supports threshold=2 (2-of-2). Ignoring --threshold={}.",
            args.threshold
        );
    }
    if args.backup && args.password.is_none() {
        anyhow::bail!("--backup requires --password");
    }

    let client = factory::authenticated_client().await?;
    let evm = DynamicEvmWalletClient::new(&client);

    println!("Creating EVM server wallet (TWO_OF_TWO)...");
    let started = std::time::Instant::now();
    let (wp, shares) = evm
        .create_wallet_account(
            ThresholdSignatureScheme::default(),
            args.password.clone(),
            args.backup,
        )
        .await
        .context("create wallet")?;

    println!(
        "Server wallet created in {:.2}s",
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
    let wallets = storage::list(Some("EVM"))?;
    if wallets.is_empty() {
        println!("No saved EVM wallets found.");
        println!("Tip: Use `cargo run --bin evm-wallet -- --create --save` to create one.");
        return Ok(());
    }
    println!("Saved EVM wallets ({}):\n", wallets.len());
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
