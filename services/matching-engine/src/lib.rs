//! Deterministic High-Performance In-Memory Order Matching Engine
//! Phase 0 Architecture Blueprint:
//! - Single-threaded execution core per trading pair/market.
//! - Event-sourced with continuous snapshotting and deterministic replay.
//! - Fixed-point integer arithmetic (u128/i128) representing base lots and quote ticks.
//! - Zero floating-point operations.

pub mod engine;
pub mod orderbook;
pub mod types;

pub use types::*;
