use crate::types::*;
use std::collections::{BTreeMap, VecDeque};

#[derive(Debug, Clone, Default)]
pub struct OrderBook {
    // Bids: price -> queue of orders (BTreeMap is sorted ascending, so reverse iterator gives highest bid first)
    pub bids: BTreeMap<Price, VecDeque<Order>>,
    // Asks: price -> queue of orders (BTreeMap is sorted ascending, so normal iterator gives lowest ask first)
    pub asks: BTreeMap<Price, VecDeque<Order>>,
}

impl OrderBook {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert_order(&mut self, order: Order) {
        match order.side {
            Side::Buy => {
                self.bids.entry(order.price).or_default().push_back(order);
            }
            Side::Sell => {
                self.asks.entry(order.price).or_default().push_back(order);
            }
        }
    }

    pub fn remove_order(&mut self, order_id: &OrderId, side: Side, price: Price) -> Option<Order> {
        let book = match side {
            Side::Buy => &mut self.bids,
            Side::Sell => &mut self.asks,
        };

        if let Some(queue) = book.get_mut(&price) {
            if let Some(pos) = queue.iter().position(|o| o.id == *order_id) {
                let removed = queue.remove(pos);
                if queue.is_empty() {
                    book.remove(&price);
                }
                return removed;
            }
        }
        None
    }

    pub fn best_bid(&self) -> Option<Price> {
        self.bids.keys().next_back().copied()
    }

    pub fn best_ask(&self) -> Option<Price> {
        self.asks.keys().next().copied()
    }

    pub fn get_depth(&self, levels: usize) -> (Vec<(Price, Quantity)>, Vec<(Price, Quantity)>) {
        let mut bid_depth = Vec::with_capacity(levels);
        for (&price, queue) in self.bids.iter().rev().take(levels) {
            let total_qty: Quantity = queue.iter().map(|o| o.remaining_quantity).sum();
            bid_depth.push((price, total_qty));
        }

        let mut ask_depth = Vec::with_capacity(levels);
        for (&price, queue) in self.asks.iter().take(levels) {
            let total_qty: Quantity = queue.iter().map(|o| o.remaining_quantity).sum();
            ask_depth.push((price, total_qty));
        }

        (bid_depth, ask_depth)
    }
}
