use crate::types::*;
use std::collections::BTreeMap;

#[derive(Debug, Default)]
pub struct OrderBook {
    pub bids: BTreeMap<Price, Vec<Order>>, // Descending price order (highest first)
    pub asks: BTreeMap<Price, Vec<Order>>, // Ascending price order (lowest first)
}

impl OrderBook {
    pub fn new() -> Self {
        Self::default()
    }
}
