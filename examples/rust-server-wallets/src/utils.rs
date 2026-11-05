//! Tiny formatting helpers shared by the demo binaries.

use crate::config;

pub fn format_address(address: &str) -> String {
    if address.len() <= 14 {
        return address.to_string();
    }
    let (lhs, rhs) = address.split_at(8);
    let suffix = &rhs[rhs.len().saturating_sub(6)..];
    format!("{lhs}...{suffix}")
}

pub fn evm_tx_link(hash: &str) -> String {
    format!("{}/tx/{}", config::EVM_EXPLORER_BASE, hash)
}

pub fn evm_address_link(address: &str) -> String {
    format!("{}/address/{}", config::EVM_EXPLORER_BASE, address)
}

pub fn solana_tx_link(signature: &str) -> String {
    format!(
        "{}/tx/{}{}",
        config::SOLANA_EXPLORER_BASE,
        signature,
        config::SOLANA_EXPLORER_QUERY
    )
}

pub fn solana_address_link(address: &str) -> String {
    format!(
        "{}/address/{}{}",
        config::SOLANA_EXPLORER_BASE,
        address,
        config::SOLANA_EXPLORER_QUERY
    )
}
