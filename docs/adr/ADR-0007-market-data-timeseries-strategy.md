# ADR-0007: Market Data Storage Strategy: In-Memory / PostgreSQL Initially, ClickHouse for Scale

## Status
Accepted

## Context
Market data encompasses real-time order book depth, trade tickers, and OHLCV candlestick time series across multiple intervals (1m, 5m, 1h, 1d). Section 3.2 specifies PostgreSQL initially with ClickHouse or TimescaleDB planned for a later phase when historical tick volume demands column-oriented compression.

## Decision
1. **Phase 0–3**: Maintain real-time order book depth in memory within `services/market-data` and broadcast via WebSockets. Aggregate OHLCV candles dynamically into PostgreSQL `market.candle` tables.
2. **Phase 4+ Scale Path**: Transition tick-level archival and long-range historical candlestick querying to **ClickHouse**.
3. Expose candle data via a clean abstract interface in `services/market-data` so the underlying storage transition from PostgreSQL to ClickHouse does not alter client-facing REST/WebSocket contracts.

## Consequences
- **Positive**: Simplifies initial architecture and operational overhead while maintaining a defined migration path for big-data timeseries scaling.
- **Negative**: Long-term historical query performance in PostgreSQL must be managed via partition tables until ClickHouse is introduced.
