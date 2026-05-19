//! Shared CLI scaffolding: tracing init + signal-aware Tokio entrypoint.

use std::future::Future;

/// Configure tracing once per process. Reads RUST_LOG (default = `info`).
pub fn init_tracing() {
    use tracing_subscriber::EnvFilter;
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .try_init();
}

/// Run an async main with sensible defaults: multi-thread Tokio runtime,
/// SIGINT cancellation, and a top-level anyhow error reporter.
pub fn run<F, Fut>(f: F)
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = anyhow::Result<()>>,
{
    init_tracing();

    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("build Tokio runtime");

    let result = rt.block_on(async {
        tokio::select! {
            res = f() => res,
            _ = tokio::signal::ctrl_c() => {
                eprintln!("\nInterrupted.");
                Ok(())
            }
        }
    });

    if let Err(err) = result {
        eprintln!("Error: {err:#}");
        std::process::exit(1);
    }
}
