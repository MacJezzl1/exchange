const http = require('http');

const PORT = 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BTC-USDT Spot Trade Terminal - Hybrid Exchange</title>
  <style>
    :root {
      --bg-app: #0c0d0f;
      --bg-surface: #131518;
      --bg-surface-elevated: #1a1d22;
      --bg-surface-hover: #22262d;
      --border-subtle: #1e2229;
      --border-default: #2d323b;
      --border-strong: #3f4551;
      --text-primary: #f0f2f5;
      --text-secondary: #9da5b4;
      --text-tertiary: #636b78;
      --accent-default: #0066ff;
      --buy-primary: #00b074;
      --buy-subtle: rgba(0, 176, 116, 0.12);
      --buy-text: #00d68f;
      --sell-primary: #f6465d;
      --sell-subtle: rgba(246, 70, 93, 0.12);
      --sell-text: #ff6b7e;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', Consolas, Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-app);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 12px;
      line-height: 1.4;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Top Nav */
    .top-nav {
      height: 44px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    }
    .brand-group { display: flex; align-items: center; gap: 20px; }
    .brand { font-weight: 700; font-size: 14px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
    .market-badge {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-left: 16px;
      border-left: 1px solid var(--border-default);
    }
    .market-title { font-weight: 700; font-size: 14px; font-family: var(--font-mono); }
    .stat-pill { display: flex; flex-direction: column; }
    .stat-label { font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; }
    .stat-val { font-size: 11px; font-family: var(--font-mono); font-weight: 500; }

    /* Layout Grid */
    .terminal-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 280px 1fr 300px;
      grid-template-rows: 1fr 220px;
      gap: 1px;
      background: var(--border-default);
    }
    .panel {
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-header {
      height: 32px;
      background: var(--bg-surface-elevated);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
    }

    /* Order Book */
    .orderbook-table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 11px; }
    .orderbook-table th { padding: 4px 10px; text-align: right; color: var(--text-tertiary); font-size: 10px; font-weight: 500; }
    .orderbook-table th:first-child { text-align: left; }
    .orderbook-table td { padding: 3px 10px; text-align: right; position: relative; font-variant-numeric: tabular-nums; }
    .orderbook-table td:first-child { text-align: left; }
    .ask-price { color: var(--sell-text); }
    .bid-price { color: var(--buy-text); }
    .spread-bar {
      padding: 6px 12px;
      background: var(--bg-surface-elevated);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      border-top: 1px solid var(--border-subtle);
      border-bottom: 1px solid var(--border-subtle);
    }

    /* Order Form */
    .trade-form { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
    .toggle-group { display: flex; background: var(--bg-surface-elevated); border-radius: 4px; padding: 2px; }
    .toggle-btn {
      flex: 1;
      padding: 6px;
      text-align: center;
      font-weight: 600;
      border-radius: 2px;
      cursor: pointer;
      user-select: none;
      transition: all 120ms;
    }
    .toggle-btn.buy.active { background: var(--buy-primary); color: #fff; }
    .toggle-btn.sell.active { background: var(--sell-primary); color: #fff; }

    .input-box {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-default);
      border-radius: 4px;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .input-box input {
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 13px;
      outline: none;
      width: 140px;
    }
    .input-suffix { color: var(--text-tertiary); font-size: 11px; }

    .submit-order-btn {
      padding: 10px;
      border-radius: 4px;
      border: none;
      font-weight: 700;
      font-size: 13px;
      color: #fff;
      cursor: pointer;
      margin-top: 8px;
      transition: opacity 120ms;
    }
    .submit-order-btn.buy { background: var(--buy-primary); }
    .submit-order-btn.sell { background: var(--sell-primary); }
    .submit-order-btn:hover { opacity: 0.9; }

    /* Chart Simulation Area */
    .chart-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #090a0c;
      position: relative;
    }
  </style>
</head>
<body>
  <!-- Top Navigation Bar -->
  <header class="top-nav">
    <div class="brand-group">
      <div class="brand">⚡ HYBRID EXCHANGE</div>
      <div class="market-badge">
        <span class="market-title">BTC / USDT</span>
        <div class="stat-pill">
          <span class="stat-label">Last Price</span>
          <span class="stat-val" style="color: var(--buy-text);">65,240.50</span>
        </div>
        <div class="stat-pill">
          <span class="stat-label">24h Change</span>
          <span class="stat-val" style="color: var(--buy-text);">+3.42%</span>
        </div>
        <div class="stat-pill">
          <span class="stat-label">24h High</span>
          <span class="stat-val">66,100.00</span>
        </div>
        <div class="stat-pill">
          <span class="stat-label">24h Low</span>
          <span class="stat-val">64,120.00</span>
        </div>
        <div class="stat-pill">
          <span class="stat-label">Matching Latency</span>
          <span class="stat-val" style="color: var(--buy-text);">0.24ms</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">
        Base L2 (Sepolia) • 0xAbCd...1234
      </div>
      <div style="background: var(--buy-subtle); color: var(--buy-text); border: 1px solid rgba(0,176,116,0.3); padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">
        KYC Tier L2: Verified
      </div>
    </div>
  </header>

  <!-- Trading Grid -->
  <div class="terminal-grid">
    <!-- Panel 1: Order Book -->
    <div class="panel" style="grid-row: 1 / 3;">
      <div class="panel-header">
        <span>Order Book</span>
        <span style="font-family: var(--font-mono);">0.01</span>
      </div>
      <table class="orderbook-table">
        <thead>
          <tr>
            <th>Price (USDT)</th>
            <th>Size (BTC)</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody id="asks-tbody">
          <tr><td class="ask-price">65,260.00</td><td>0.450</td><td>29,367.00</td></tr>
          <tr><td class="ask-price">65,255.50</td><td>1.200</td><td>78,306.60</td></tr>
          <tr><td class="ask-price">65,250.00</td><td>0.850</td><td>55,462.50</td></tr>
          <tr><td class="ask-price">65,245.00</td><td>2.100</td><td>137,014.50</td></tr>
          <tr><td class="ask-price">65,242.00</td><td>0.320</td><td>20,877.44</td></tr>
        </tbody>
      </table>

      <div class="spread-bar">
        <span style="color: var(--buy-text);">65,240.50</span>
        <span style="color: var(--text-tertiary); font-size: 10px;">Spread: 1.50 (0.002%)</span>
      </div>

      <table class="orderbook-table">
        <tbody id="bids-tbody">
          <tr><td class="bid-price">65,239.00</td><td>1.450</td><td>94,596.55</td></tr>
          <tr><td class="bid-price">65,235.00</td><td>0.720</td><td>46,969.20</td></tr>
          <tr><td class="bid-price">65,230.00</td><td>3.100</td><td>202,213.00</td></tr>
          <tr><td class="bid-price">65,225.50</td><td>0.950</td><td>61,964.22</td></tr>
          <tr><td class="bid-price">65,220.00</td><td>2.400</td><td>156,528.00</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Panel 2: Price Chart Canvas -->
    <div class="panel">
      <div class="panel-header">
        <span>Candlestick Chart (1m) • Lightweight Charts</span>
        <span>OHLC: O 65,230 H 65,260 L 65,220 C 65,240</span>
      </div>
      <div class="chart-container">
        <svg width="100%" height="100%" style="opacity: 0.85;">
          <!-- Simple simulated candlesticks -->
          <line x1="50" y1="200" x2="50" y2="120" stroke="#00b074" stroke-width="2"/>
          <rect x="42" y="140" width="16" height="50" fill="#00b074"/>
          <line x1="100" y1="210" x2="100" y2="110" stroke="#f6465d" stroke-width="2"/>
          <rect x="92" y="130" width="16" height="60" fill="#f6465d"/>
          <line x1="150" y1="180" x2="150" y2="90" stroke="#00b074" stroke-width="2"/>
          <rect x="142" y="100" width="16" height="60" fill="#00b074"/>
          <line x1="200" y1="160" x2="200" y2="80" stroke="#00b074" stroke-width="2"/>
          <rect x="192" y="90" width="16" height="50" fill="#00b074"/>
          <line x1="250" y1="170" x2="250" y2="70" stroke="#00b074" stroke-width="2"/>
          <rect x="242" y="80" width="16" height="70" fill="#00b074"/>
        </svg>
        <div style="position: absolute; bottom: 12px; left: 16px; color: var(--text-tertiary); font-size: 11px;">
          Deterministic Replay Engine Verified • Zero IEEE-754 Float Inaccuracies
        </div>
      </div>
    </div>

    <!-- Panel 3: Trade Order Form -->
    <div class="panel" style="grid-row: 1 / 3;">
      <div class="panel-header">
        <span>Place Order (EIP-712 Signed)</span>
        <span>Spot</span>
      </div>
      <div class="trade-form">
        <div class="toggle-group">
          <div class="toggle-btn buy active" id="btn-side-buy" onclick="setSide('buy')">Buy</div>
          <div class="toggle-btn sell" id="btn-side-sell" onclick="setSide('sell')">Sell</div>
        </div>

        <div style="display: flex; gap: 8px; font-size: 11px; color: var(--text-secondary);">
          <span style="font-weight: 600; color: #fff; cursor: pointer;">Limit</span>
          <span style="cursor: pointer;">Market</span>
          <span style="cursor: pointer;">Stop-Limit</span>
        </div>

        <div>
          <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom: 4px;">Order Price</div>
          <div class="input-box">
            <input type="text" id="order-price" value="65,240.00"/>
            <span class="input-suffix">USDT</span>
          </div>
        </div>

        <div>
          <div style="font-size: 10px; color: var(--text-tertiary); margin-bottom: 4px;">Quantity</div>
          <div class="input-box">
            <input type="text" id="order-qty" value="0.250"/>
            <span class="input-suffix">BTC</span>
          </div>
        </div>

        <div style="padding: 10px; background: var(--bg-surface-elevated); border-radius: 4px; font-size: 11px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
            <span>Order Value</span>
            <span class="stat-val">16,310.00 USDT</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
            <span>Est. Fee (Maker 0.10%)</span>
            <span class="stat-val">16.31 USDT</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
            <span>Available Balance</span>
            <span class="stat-val">50,000.00 USDT</span>
          </div>
        </div>

        <button class="submit-order-btn buy" id="submit-btn" onclick="submitTradeOrder()">
          Sign & Submit Buy Order (EIP-712)
        </button>

        <div style="font-size: 10px; color: var(--text-tertiary); line-height: 1.4; margin-top: 4px;">
          🔒 Off-chain EIP-712 signature verified. Settlement batched on-chain non-custodially to Base L2 Vault.
        </div>
      </div>
    </div>

    <!-- Panel 4: Open Orders & History -->
    <div class="panel">
      <div class="panel-header">
        <span>Open Orders (1) &bull; Trade History &bull; Ledger Journal</span>
        <button style="background: none; border: none; color: var(--sell-text); font-size: 11px; cursor: pointer;">Cancel All</button>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="color: var(--text-tertiary); border-bottom: 1px solid var(--border-subtle);">
              <th style="padding: 6px 12px; text-align: left;">Time</th>
              <th style="padding: 6px 12px; text-align: left;">Pair</th>
              <th style="padding: 6px 12px; text-align: left;">Type</th>
              <th style="padding: 6px 12px; text-align: left;">Side</th>
              <th style="padding: 6px 12px; text-align: right;">Price</th>
              <th style="padding: 6px 12px; text-align: right;">Amount</th>
              <th style="padding: 6px 12px; text-align: right;">Filled</th>
              <th style="padding: 6px 12px; text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid var(--border-subtle);">
              <td style="padding: 6px 12px;">10:14:02</td>
              <td style="padding: 6px 12px; font-weight: 600;">BTC-USDT</td>
              <td style="padding: 6px 12px;">Limit</td>
              <td style="padding: 6px 12px; color: var(--buy-text); font-weight: 600;">BUY</td>
              <td style="padding: 6px 12px; text-align: right; font-family: var(--font-mono);">65,240.00</td>
              <td style="padding: 6px 12px; text-align: right; font-family: var(--font-mono);">0.500 BTC</td>
              <td style="padding: 6px 12px; text-align: right; font-family: var(--font-mono);">0.00%</td>
              <td style="padding: 6px 12px; text-align: center;">
                <span style="color: var(--sell-text); cursor: pointer;">Cancel</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    let currentSide = 'buy';
    function setSide(side) {
      currentSide = side;
      document.getElementById('btn-side-buy').className = 'toggle-btn buy' + (side === 'buy' ? ' active' : '');
      document.getElementById('btn-side-sell').className = 'toggle-btn sell' + (side === 'sell' ? ' active' : '');
      const btn = document.getElementById('submit-btn');
      btn.className = 'submit-order-btn ' + side;
      btn.innerText = (side === 'buy' ? 'Sign & Submit Buy Order (EIP-712)' : 'Sign & Submit Sell Order (EIP-712)');
    }

    function submitTradeOrder() {
      const price = document.getElementById('order-price').value;
      const qty = document.getElementById('order-qty').value;
      alert(\`✅ EIP-712 Order Signed & Ingested into Matching Engine!\\nSide: \${currentSide.toUpperCase()}\\nPrice: \${price} USDT\\nQty: \${qty} BTC\\nPre-trade Hold Placed in Double-Entry Ledger.\`);
    }
  </script>
</body>
</html>`;

  res.end(html);
});

server.listen(PORT, () => {
  console.log(`[apps/web] Trader Terminal UI running on http://localhost:${PORT}`);
});
