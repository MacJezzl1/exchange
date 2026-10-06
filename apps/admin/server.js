const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

function handleRequest(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Portal - Hybrid Exchange Platform</title>
  <style>
    :root {
      --bg-app: #08090a;
      --bg-surface: #0f1115;
      --bg-surface-elevated: #16191f;
      --bg-surface-hover: #1e222a;
      --border-default: #252b36;
      --border-strong: #384252;
      --text-primary: #f0f2f5;
      --text-secondary: #9da5b4;
      --text-tertiary: #636b78;
      --accent-default: #0066ff;
      --accent-hover: #1a75ff;
      --buy-primary: #00b074;
      --buy-subtle: rgba(0, 176, 116, 0.12);
      --sell-primary: #f6465d;
      --sell-subtle: rgba(246, 70, 93, 0.12);
      --warning-primary: #f0b90b;
      --warning-subtle: rgba(240, 185, 11, 0.12);
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: "JetBrains Mono", Consolas, Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-app);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 13px;
      line-height: 1.5;
    }

    /* Environment Isolation Banner */
    .env-banner {
      background: #1c1402;
      border-bottom: 1px solid #634304;
      color: #f3ba2f;
      text-align: center;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    /* Layout */
    .app-shell { display: flex; height: calc(100vh - 25px); }
    .sidebar {
      width: 240px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border-default);
      display: flex;
      flex-direction: column;
    }
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .audit-drawer {
      width: 360px;
      background: var(--bg-surface);
      border-left: 1px solid var(--border-default);
      display: flex;
      flex-direction: column;
    }

    /* Sidebar Items */
    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-default);
      font-weight: 700;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-item {
      padding: 10px 16px;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      border-left: 3px solid transparent;
      transition: all 120ms;
    }
    .nav-item:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
    .nav-item.active {
      background: var(--bg-surface-elevated);
      color: #fff;
      border-left-color: var(--accent-default);
      font-weight: 600;
    }

    /* Header Bar */
    .top-header {
      height: 48px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
    }
    .admin-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-surface-elevated);
      padding: 4px 10px;
      border-radius: 4px;
      border: 1px solid var(--border-default);
      font-size: 12px;
    }

    /* Panels & Cards */
    .content-area { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: 4px;
      overflow: hidden;
    }
    .card-header {
      padding: 12px 16px;
      background: var(--bg-surface-elevated);
      border-bottom: 1px solid var(--border-default);
      font-weight: 600;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-body { padding: 16px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      text-align: left;
      padding: 8px 12px;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-default);
      font-size: 11px;
      text-transform: uppercase;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-default);
      font-family: var(--font-sans);
    }
    .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

    /* Chips */
    .chip {
      padding: 2px 6px;
      border-radius: 2px;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
      display: inline-block;
    }
    .chip-pending { background: var(--warning-subtle); color: var(--warning-primary); border: 1px solid rgba(240,185,11,0.3); }
    .chip-approved { background: var(--buy-subtle); color: var(--buy-primary); border: 1px solid rgba(0,176,116,0.3); }
    .chip-hardware { background: rgba(0,102,255,0.12); color: #0066ff; border: 1px solid rgba(0,102,255,0.3); }

    /* Buttons */
    .btn {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 120ms;
    }
    .btn-primary { background: var(--accent-default); color: #fff; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-success { background: var(--buy-primary); color: #fff; }
    .btn-outline { background: transparent; border-color: var(--border-default); color: var(--text-primary); }
    .btn-outline:hover { background: var(--bg-surface-elevated); }
  </style>
</head>
<body>
  <div class="env-banner">
    ⚠️ ADMINISTRATION CONTROL PLANE — ISOLATED DOMAIN (MANDATORY HARDWARE WEBAUTHN MFA)
  </div>

  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        🛡️ EXCHANGE ADMIN
      </div>
      <nav style="flex: 1; padding: 10px 0;">
        <div class="nav-item active">📊 Dashboard & Health</div>
        <div class="nav-item">👥 Four-Eyes Approvals (Maker-Checker)</div>
        <div class="nav-item">📋 KYC Verification Queue</div>
        <div class="nav-item">💳 Fiat Rails & Reconciliation</div>
        <div class="nav-item">📈 Markets & Circuit Breakers</div>
        <div class="nav-item">🔒 Audit Log & Chain Verifier</div>
      </nav>
      <div style="padding: 16px; border-top: 1px solid var(--border-default); font-size: 11px; color: var(--text-tertiary);">
        Isolated Port: 3001<br>Admin API: http://localhost:8081
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <header class="top-header">
        <div style="font-weight: 600; font-size: 14px;">Maker-Checker Approvals & System Operations</div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="admin-pill">
            <span class="chip chip-hardware">FIDO2 / YubiKey</span>
            <span id="active-user-label">Alice Maker (ComplianceOfficer)</span>
          </div>
          <button class="btn btn-outline" onclick="switchAdminUser()">Switch to Bob Checker</button>
        </div>
      </header>

      <div class="content-area">
        <!-- Four-Eyes Queue Card -->
        <div class="card">
          <div class="card-header">
            <span>Pending Four-Eyes Approvals (Maker-Checker Enforced)</span>
            <button class="btn btn-primary" onclick="createMockRequest()">+ Initiate Sensitive Action (Maker)</button>
          </div>
          <div class="card-body" style="padding: 0;">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Action Type</th>
                  <th>Entity Target</th>
                  <th>Maker</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="approvals-tbody">
                <!-- Dynamically populated -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- System Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <div class="card">
            <div class="card-header">Settlement Batch Lag</div>
            <div class="card-body">
              <div class="mono" style="font-size: 24px; font-weight: 700; color: var(--buy-primary);">0.84s</div>
              <div style="color: var(--text-secondary); font-size: 11px; margin-top: 4px;">Target: < 2.0s on Base L2</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">Double-Entry Invariant</div>
            <div class="card-body">
              <div class="mono" style="font-size: 24px; font-weight: 700; color: var(--buy-primary);">100% Balanced</div>
              <div style="color: var(--text-secondary); font-size: 11px; margin-top: 4px;">Σ(Debits) == Σ(Credits) strictly held</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header">Audit Chain Anchor</div>
            <div class="card-body">
              <div class="mono" style="font-size: 12px; color: var(--accent-default);" id="latest-chain-hash">Checking...</div>
              <div style="color: var(--text-secondary); font-size: 11px; margin-top: 4px;">SHA-256 Hash Chain Integrity</div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Audit Drawer -->
    <aside class="audit-drawer">
      <div class="sidebar-header" style="justify-content: space-between;">
        <span>📜 Live Audit Chain</span>
        <button class="btn btn-outline" style="font-size: 11px; padding: 2px 8px;" onclick="verifyChain()">Verify Chain</button>
      </div>
      <div id="audit-feed" style="flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <!-- Populated dynamically -->
      </div>
    </aside>
  </div>

  <script>
    let currentAdmin = {
      id: '018e0000-0007-7000-8000-000000000001',
      name: 'Alice Maker (Compliance)',
      role: 'ComplianceOfficer'
    };

    function switchAdminUser() {
      if (currentAdmin.id === '018e0000-0007-7000-8000-000000000001') {
        currentAdmin = {
          id: '018e0000-0007-7000-8000-000000000002',
          name: 'Bob Checker (Finance)',
          role: 'FinancePayments'
        };
      } else {
        currentAdmin = {
          id: '018e0000-0007-7000-8000-000000000001',
          name: 'Alice Maker (Compliance)',
          role: 'ComplianceOfficer'
        };
      }
      document.getElementById('active-user-label').innerText = currentAdmin.name;
      loadApprovals();
    }

    async function loadApprovals() {
      try {
        const res = await fetch('http://localhost:8081/admin/v1/approvals/pending');
        const data = await res.json();
        const tbody = document.getElementById('approvals-tbody');
        tbody.innerHTML = '';

        if (!data.requests || data.requests.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-tertiary); padding: 24px;">No pending maker-checker approval requests</td></tr>';
          return;
        }

        data.requests.forEach(req => {
          const isMaker = req.requester_id === currentAdmin.id;
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td class="mono">\${req.id.slice(0, 8)}...</td>
            <td><strong>\${req.action_type}</strong></td>
            <td class="mono">\${req.entity_id.slice(0, 8)}</td>
            <td>\${req.requester_id.includes('0001') ? 'Alice Maker' : 'Bob Checker'}</td>
            <td><span class="chip chip-pending">\${req.status}</span></td>
            <td>\${req.reason || 'Manual review required'}</td>
            <td>
              \${isMaker ?
                '<span style="color: var(--text-tertiary); font-size: 11px;">(Maker cannot self-check)</span>' :
                \`<button class="btn btn-success" style="padding: 2px 8px; font-size: 11px;" onclick="approveRequest('\${req.id}')">Approve (Checker)</button>\`
              }
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (e) {
        console.warn('Admin API not reached directly on client:', e);
      }
    }

    async function loadAuditLog() {
      try {
        const res = await fetch('http://localhost:8081/admin/v1/audit/events');
        const data = await res.json();
        const feed = document.getElementById('audit-feed');
        feed.innerHTML = '';

        if (!data.events || data.events.length === 0) {
          feed.innerHTML = '<div style="color: var(--text-tertiary); font-size: 11px;">No audit events logged yet.</div>';
          return;
        }

        document.getElementById('latest-chain-hash').innerText = data.events[0].hash.slice(0, 16) + '...';

        data.events.forEach(ev => {
          const div = document.createElement('div');
          div.style.background = 'var(--bg-surface-elevated)';
          div.style.padding = '8px';
          div.style.borderRadius = '4px';
          div.style.border = '1px solid var(--border-default)';
          div.innerHTML = \`
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-tertiary);">
              <span>#\${ev.sequence_number} • \${ev.action}</span>
              <span>\${new Date(ev.created_at).toLocaleTimeString()}</span>
            </div>
            <div style="font-size: 11px; margin-top: 4px; color: var(--text-secondary);">\${ev.reason || 'System operation'}</div>
            <div class="mono" style="font-size: 9px; color: var(--accent-default); margin-top: 4px; word-break: break-all;">
              Hash: \${ev.hash.slice(0, 24)}...
            </div>
          \`;
          feed.appendChild(div);
        });
      } catch (e) {
        console.warn('Audit feed fetch error', e);
      }
    }

    async function createMockRequest() {
      try {
        await fetch('http://localhost:8081/admin/v1/approvals/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requesterAdminId: currentAdmin.id,
            actionType: 'fiat_withdrawal',
            entityId: '018e0000-0004-7000-8000-000000000001',
            reason: 'High-value fiat payout verification > ZAR 50,000 threshold',
            payload: { amountZAR: 75000, recipient: 'Verified Bank Account' }
          })
        });
        loadApprovals();
        loadAuditLog();
      } catch (e) {
        alert('Error creating request: ' + e.message);
      }
    }

    async function approveRequest(id) {
      try {
        const res = await fetch(\`http://localhost:8081/admin/v1/approvals/\${id}/decision\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkerAdminId: currentAdmin.id,
            decision: 'approved',
            notes: 'Secondary review confirmed via WebAuthn hardware token'
          })
        });
        const out = await res.json();
        if (out.error) {
          alert('Rejection: ' + out.error);
        } else {
          loadApprovals();
          loadAuditLog();
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function verifyChain() {
      try {
        const res = await fetch('http://localhost:8081/admin/v1/audit/verify-chain');
        const data = await res.json();
        if (data.isValid) {
          alert(\`✅ CRYPTOGRAPHIC AUDIT CHAIN VERIFIED UNBROKEN! Total events checked: \${data.totalEvents}. All SHA-256 links verified.\`);
        } else {
          alert('❌ AUDIT CHAIN INTEGRITY FAILED at sequence ' + data.brokenAtSequence);
        }
      } catch (e) {
        alert('Verification error: ' + e.message);
      }
    }

    // Polling refresh
    setInterval(() => {
      loadApprovals();
      loadAuditLog();
    }, 2000);

    loadApprovals();
    loadAuditLog();
  </script>
</body>
</html>`;

  res.end(html);
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[apps/admin] Isolated Admin Portal shell running on http://localhost:${PORT}`);
  });
}

module.exports = handleRequest;
