use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    info!("Starting Hybrid Exchange Matching Engine Core [Rust]...");
    info!("Phase 0 scaffold verified. Ready for deterministic single-threaded order book initialization.");
    Ok(())
}
