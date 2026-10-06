use crate::orderbook::OrderBook;
use crate::types::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineSnapshot {
    pub sequence: SequenceNumber,
    pub market_id: Uuid,
    pub orders: HashMap<OrderId, Order>,
}

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

    pub fn process_order(&mut self, mut order: Order) -> Vec<EngineEvent> {
        let mut events = Vec::new();

        // 1. PostOnly Check
        if order.order_type == OrderType::PostOnly {
            let would_cross = match order.side {
                Side::Buy => self.book.best_ask().map_or(false, |ask| order.price >= ask),
                Side::Sell => self.book.best_bid().map_or(false, |bid| order.price <= bid),
            };
            if would_cross {
                self.sequence += 1;
                events.push(EngineEvent::OrderCancelled {
                    sequence: self.sequence,
                    order_id: order.id,
                    reason: "post_only_would_cross_book".to_string(),
                });
                return events;
            }
        }

        // 2. FillOrKill Check
        if order.order_type == OrderType::FillOrKill {
            let can_fill = self.can_fill_completely(&order);
            if !can_fill {
                self.sequence += 1;
                events.push(EngineEvent::OrderCancelled {
                    sequence: self.sequence,
                    order_id: order.id,
                    reason: "fok_insufficient_liquidity".to_string(),
                });
                return events;
            }
        }

        // 3. Match against book
        match order.side {
            Side::Buy => {
                while order.remaining_quantity > 0 {
                    let best_ask_price = match self.book.best_ask() {
                        Some(p) => p,
                        None => break,
                    };

                    if order.order_type == OrderType::Limit && order.price < best_ask_price {
                        break; // Buy limit price is lower than best ask -> rest on book
                    }

                    let ask_queue = self.book.asks.get_mut(&best_ask_price).unwrap();
                    let mut maker_order = ask_queue.pop_front().unwrap();

                    let match_qty = std::cmp::min(order.remaining_quantity, maker_order.remaining_quantity);
                    let execution_price = maker_order.price; // Maker sets the price in continuous trading

                    order.remaining_quantity -= match_qty;
                    maker_order.remaining_quantity -= match_qty;

                    self.sequence += 1;
                    events.push(EngineEvent::TradeExecuted {
                        sequence: self.sequence,
                        trade: Trade {
                            trade_id: Uuid::new_v4(),
                            sequence: self.sequence,
                            market_id: self.market_id,
                            maker_order_id: maker_order.id,
                            taker_order_id: order.id,
                            maker_user_id: maker_order.user_id,
                            taker_user_id: order.user_id,
                            side: Side::Buy,
                            price: execution_price,
                            quantity: match_qty,
                            timestamp_ns: order.timestamp_ns,
                        },
                    });

                    if maker_order.remaining_quantity > 0 {
                        ask_queue.push_front(maker_order);
                    } else {
                        self.orders.remove(&maker_order.id);
                    }

                    if ask_queue.is_empty() {
                        self.book.asks.remove(&best_ask_price);
                    }
                }
            }
            Side::Sell => {
                while order.remaining_quantity > 0 {
                    let best_bid_price = match self.book.best_bid() {
                        Some(p) => p,
                        None => break,
                    };

                    if order.order_type == OrderType::Limit && order.price > best_bid_price {
                        break; // Sell limit price is higher than best bid -> rest on book
                    }

                    let bid_queue = self.book.bids.get_mut(&best_bid_price).unwrap();
                    let mut maker_order = bid_queue.pop_front().unwrap();

                    let match_qty = std::cmp::min(order.remaining_quantity, maker_order.remaining_quantity);
                    let execution_price = maker_order.price;

                    order.remaining_quantity -= match_qty;
                    maker_order.remaining_quantity -= match_qty;

                    self.sequence += 1;
                    events.push(EngineEvent::TradeExecuted {
                        sequence: self.sequence,
                        trade: Trade {
                            trade_id: Uuid::new_v4(),
                            sequence: self.sequence,
                            market_id: self.market_id,
                            maker_order_id: maker_order.id,
                            taker_order_id: order.id,
                            maker_user_id: maker_order.user_id,
                            taker_user_id: order.user_id,
                            side: Side::Sell,
                            price: execution_price,
                            quantity: match_qty,
                            timestamp_ns: order.timestamp_ns,
                        },
                    });

                    if maker_order.remaining_quantity > 0 {
                        bid_queue.push_front(maker_order);
                    } else {
                        self.orders.remove(&maker_order.id);
                    }

                    if bid_queue.is_empty() {
                        self.book.bids.remove(&best_bid_price);
                    }
                }
            }
        }

        // 4. Handle remaining quantity
        if order.remaining_quantity > 0 {
            if order.order_type == OrderType::ImmediateOrCancel || order.order_type == OrderType::Market {
                self.sequence += 1;
                events.push(EngineEvent::OrderCancelled {
                    sequence: self.sequence,
                    order_id: order.id,
                    reason: "ioc_unfilled_remainder".to_string(),
                });
            } else {
                // Rest on book
                self.sequence += 1;
                events.push(EngineEvent::OrderAccepted {
                    sequence: self.sequence,
                    order: order.clone(),
                });
                self.orders.insert(order.id, order.clone());
                self.book.insert_order(order);
            }
        }

        events
    }

    pub fn cancel_order(&mut self, order_id: &OrderId, reason: &str) -> Option<EngineEvent> {
        if let Some(order) = self.orders.remove(order_id) {
            self.book.remove_order(order_id, order.side, order.price);
            self.sequence += 1;
            Some(EngineEvent::OrderCancelled {
                sequence: self.sequence,
                order_id: *order_id,
                reason: reason.to_string(),
            })
        } else {
            None
        }
    }

    pub fn create_snapshot(&self) -> EngineSnapshot {
        EngineSnapshot {
            sequence: self.sequence,
            market_id: self.market_id,
            orders: self.orders.clone(),
        }
    }

    pub fn restore_snapshot(&mut self, snapshot: EngineSnapshot) {
        self.market_id = snapshot.market_id;
        self.sequence = snapshot.sequence;
        self.orders = snapshot.orders;
        self.book = OrderBook::new();

        for order in self.orders.values() {
            self.book.insert_order(order.clone());
        }
    }

    fn can_fill_completely(&self, order: &Order) -> bool {
        let mut needed = order.quantity;
        match order.side {
            Side::Buy => {
                for (&price, queue) in self.book.asks.iter() {
                    if order.order_type == OrderType::Limit && price > order.price {
                        break;
                    }
                    for maker in queue.iter() {
                        if needed <= maker.remaining_quantity {
                            return true;
                        }
                        needed -= maker.remaining_quantity;
                    }
                }
            }
            Side::Sell => {
                for (&price, queue) in self.book.bids.iter().rev() {
                    if order.order_type == OrderType::Limit && price < order.price {
                        break;
                    }
                    for maker in queue.iter() {
                        if needed <= maker.remaining_quantity {
                            return true;
                        }
                        needed -= maker.remaining_quantity;
                    }
                }
            }
        }
        false
    }
}
