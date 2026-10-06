# ADR-0006: NATS JetStream as Core Event Bus and Streaming Backbone

## Status
Accepted

## Context
Microservices and the matching engine require a low-latency, ordered, persistent publish/subscribe message broker supporting replay, at-least-once delivery, consumer groups, and high throughput. Section 3.2 allows NATS JetStream or Kafka.

## Decision
Adopt **NATS JetStream** as the event bus backbone over Kafka.

### Rationale:
1. **Low Overhead & Latency**: Sub-millisecond publish and dispatch latencies critical for feeding order commands into the matching engine and distributing trade execution events.
2. **Built-in Persistence**: JetStream provides distributed stream storage, subject-based routing (e.g., `market.*.trades`, `order.events.>`), deduplication windows, and durable consumer acknowledgments.
3. **Simpler Operational Footprint**: Single binary written in Go with no JVM dependencies, ZooKeeper/KRaft complexity, or heavy memory footprints.
4. **First-Class Rust and TypeScript Clients**: Native asynchronous client libraries with strong typing and connection pooling.

## Consequences
- **Positive**: Extremely low latency, simple operations in Docker/Kubernetes, lightweight local development, seamless subject filtering.
- **Negative**: Smaller enterprise ecosystem compared to Kafka, but thoroughly suited for trading systems.
