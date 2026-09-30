//! Shared helpers for the Dynamic Rust server-wallet examples.
//!
//! Each binary in `src/bin/` is a thin shim around one SDK method. The
//! plumbing — config loading, client construction, local JSON storage —
//! lives here so the demos stay focused.

pub mod cli;
pub mod config;
pub mod delegated;
pub mod dynamic;
pub mod storage;
pub mod utils;
pub mod walletops;

/// Banner printed at the top of every binary so it's visible in CI / shared
/// terminal sessions that demos are using *test* infrastructure.
pub const SAFETY_BANNER: &str =
    "[rust-server-wallets] WARNING: local .wallets.json is for testing only — \
     production deployments must vault key shares.";
