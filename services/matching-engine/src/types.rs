use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Side of an order
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Side {
    Buy,
    Sell,
}

/// Order type supported by the matching engine core
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderType {
    Limit,
    Market,
    PostOnly,
    ImmediateOrCancel,
    FillOrKill,
}

/// Quantities are stored strictly as 128-bit unsigned integers representing atomic units (no floating point)
pub type Price = u128;
pub type Quantity = u128;
pub type OrderId = Uuid;
pub type SequenceNumber = u64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: OrderId,
    pub user_id: Uuid,
    pub market_id: Uuid,
    pub side: Side,
    pub order_type: OrderType,
    pub price: Price,
    pub quantity: Quantity,
    pub remaining_quantity: Quantity,
    pub client_order_id: Option<String>,
    pub timestamp_ns: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub trade_id: Uuid,
    pub sequence: SequenceNumber,
    pub market_id: Uuid,
    pub maker_order_id: OrderId,
    pub taker_order_id: OrderId,
    pub maker_user_id: Uuid,
    pub taker_user_id: Uuid,
    pub side: Side,
    pub price: Price,
    pub quantity: Quantity,
    pub timestamp_ns: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EngineEvent {
    OrderAccepted {
        sequence: SequenceNumber,
        order: Order,
    },
    TradeExecuted {
        sequence: SequenceNumber,
        trade: Trade,
    },
    OrderCancelled {
        sequence: SequenceNumber,
        order_id: OrderId,
        reason: String,
    },
}
