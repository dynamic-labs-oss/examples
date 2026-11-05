//! Recover key shares for a wallet that was created with
//! `back_up_to_dynamic=true`. After recovery, the shares can be re-vaulted
//! and used for signing.
//!
//! Example:
//!
//!   cargo run --bin evm-recover-key-shares -- \
//!       --wallet-id <uuid> \
//!       --password mySecretPassword \
//!       --key-share-id <ks-uuid>
//!
//! `wallet-id` and `key-share-id` come from the original backup. The Node
//! and Python SDKs read them out of
//! `wallet_properties.external_server_key_shares_backup_info.backups["dynamic"]`;
//! this binary takes them as flags so it can recover without first
//! retrieving the full WalletProperties.

use anyhow::Context;
use clap::Parser;
use dynamic_waas_sdk::run_recover_key_shares;

use rust_server_wallets::{cli, dynamic as factory};

#[derive(Parser, Debug)]
#[command(about = "Recover backed-up key shares for a Dynamic wallet")]
struct Args {
    /// Wallet UUID (returned by create_wallet_account as `wallet_id`)
    #[arg(long)]
    wallet_id: String,
    /// Backup password (must match the password used at create time)
    #[arg(long)]
    password: String,
    /// One or more server-assigned key share UUIDs from the original backup
    #[arg(long, required = true)]
    key_share_id: Vec<String>,
}

fn main() {
    cli::run(|| async {
        let args = Args::parse();

        let client = factory::authenticated_client().await?;
        println!("Recovering {} key share(s)...", args.key_share_id.len());
        let started = std::time::Instant::now();

        let shares =
            run_recover_key_shares(&client, &args.wallet_id, args.key_share_id, &args.password)
                .await
                .context("recover key shares")?;

        println!(
            "Recovered {} share(s) in {:.2}s",
            shares.len(),
            started.elapsed().as_secs_f64()
        );
        for (i, s) in shares.iter().enumerate() {
            println!("  share {}: keygen_id={}", i + 1, s.key_share_id);
        }
        println!();
        println!("These shares are now in memory only. Re-vault them in your KMS / database");
        println!("if you intend to use them in future sessions.");
        Ok(())
    })
}
