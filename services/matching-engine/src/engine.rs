use crate::orderbook::OrderBook;
use crate::types::*;
use std::collections::HashMap;
use uuid::Uuid;

pub struct MatchingEngine {
    pub market_id: Uuid,
    pub book: OrderBook,
    pub sequence: SequenceNumber,
    pub orders: HashMap<OrderId, Order>,
}

impl MatchingEngine {
    pub fn new(market_id: Uuid) -> Self {
        Self {
            market_id,
            book: OrderBook::new(),
            sequence: 0,
            orders: HashMap::new(),
        }
    }
}
