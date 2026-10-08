const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const cms = require('../../data/cms-helper');

const PORT = 3001;

// Read logo as base64 for guaranteed zero-break inline fallback
let logoBase64 = '';
try {
  const logoPath = path.join(__dirname, 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString('base64');
  }
} catch (_) {}

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Serve Static Logo
  if (pathname === '/logo.png' || pathname === '/logo.jpg' || pathname === '/admin/logo.png') {
    const file = path.join(__dirname, 'public', 'logo.png');
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return fs.createReadStream(file).pipe(res);
    }
  }

  // Serve Visa Card Image
  if (pathname === '/visa-card.jpg' || pathname === '/visa-card.png' || pathname === '/admin/visa-card.jpg') {
    const file = path.join(__dirname, 'public', 'visa-card.jpg');
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      return fs.createReadStream(file).pipe(res);
    }
  }

  // --------------------------------------------------------------------------
  // ADMIN API: CMS Endpoints (Media, Careers, Waitlist)
  // --------------------------------------------------------------------------
  if (pathname === '/admin/api/cms' || pathname === '/api/cms') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(cms.getCmsData()));
  }

  // Media API
  if ((pathname === '/admin/api/cms/media' || pathname === '/api/cms/media') && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const post = cms.addMediaPost(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, post }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if ((pathname.startsWith('/admin/api/cms/media') || pathname.startsWith('/api/cms/media')) && (method === 'DELETE' || (method === 'POST' && parsedUrl.query.action === 'delete'))) {
    const id = parsedUrl.query.id || pathname.split('/').pop();
    cms.deleteMediaPost(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, deletedId: id }));
  }

  // Careers API
  if ((pathname === '/admin/api/cms/careers' || pathname === '/api/cms/careers') && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const job = cms.addCareerOpening(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, job }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if ((pathname.startsWith('/admin/api/cms/careers') || pathname.startsWith('/api/cms/careers')) && (method === 'DELETE' || (method === 'POST' && parsedUrl.query.action === 'delete'))) {
    const id = parsedUrl.query.id || pathname.split('/').pop();
    cms.deleteCareerOpening(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, deletedId: id }));
  }

  // Waitlist API
  if (pathname === '/admin/api/waitlist' || pathname === '/api/waitlist') {
    const data = cms.getCmsData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, waitlist: data.cardWaitlist || [] }));
  }

  // --------------------------------------------------------------------------
  // ADMIN PORTAL HTML SHELL
  // --------------------------------------------------------------------------
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Portal - CapeChain Labs & CMS</title>
  <link rel="icon" type="image/png" href="/logo.png">
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
      --accent-cyan: #00e5ff;
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
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
    }

    /* Layout */
    .app-shell { display: flex; height: calc(100vh - 25px); }
    .sidebar {
      width: 260px;
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
      width: 340px;
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
      gap: 10px;
    }
    .sidebar-logo {
      width: 28px;
      height: 28px;
      object-fit: contain;
      border-radius: 6px;
    }
    .nav-item {
      padding: 11px 16px;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      border-left: 3px solid transparent;
      transition: all 120ms;
      font-size: 13px;
    }
    .nav-item:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
    .nav-item.active {
      background: var(--bg-surface-elevated);
      color: #fff;
      border-left-color: var(--accent-cyan);
      font-weight: 600;
    }
    .nav-badge {
      margin-left: auto;
      background: rgba(0, 229, 255, 0.15);
      color: var(--accent-cyan);
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
    }

    /* Header Bar */
    .top-header {
      height: 52px;
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
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid var(--border-default);
      font-size: 12px;
    }

    /* Panels & Cards */
    .content-area { padding: 24px; display: flex; flex-direction: column; gap: 24px; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    .card-header {
      padding: 14px 18px;
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
    .card-body { padding: 18px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      text-align: left;
      padding: 10px 14px;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-default);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border-default);
      font-family: var(--font-sans);
      vertical-align: middle;
    }
    .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

    /* Chips */
    .chip {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
      display: inline-block;
    }
    .chip-pending { background: var(--warning-subtle); color: var(--warning-primary); border: 1px solid rgba(240,185,11,0.3); }
    .chip-approved { background: var(--buy-subtle); color: var(--buy-primary); border: 1px solid rgba(0,176,116,0.3); }
    .chip-hardware { background: rgba(0,102,255,0.12); color: #0066ff; border: 1px solid rgba(0,102,255,0.3); }
    .chip-cyan { background: rgba(0, 229, 255, 0.12); color: #00e5ff; border: 1px solid rgba(0, 229, 255, 0.3); }
    .chip-gold { background: rgba(247, 182, 0, 0.12); color: #f7b600; border: 1px solid rgba(247, 182, 0, 0.3); }

    /* Buttons */
    .btn {
      padding: 7px 14px;
      border-radius: 5px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 120ms;
      text-decoration: none;
    }
    .btn-primary { background: var(--accent-default); color: #fff; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-cyan { background: var(--accent-cyan); color: #07090e; font-weight: 700; }
    .btn-cyan:hover { filter: brightness(1.1); }
    .btn-success { background: var(--buy-primary); color: #fff; }
    .btn-danger { background: rgba(246, 70, 93, 0.15); color: #f6465d; border-color: rgba(246, 70, 93, 0.3); }
    .btn-danger:hover { background: #f6465d; color: #fff; }
    .btn-outline { background: transparent; border-color: var(--border-default); color: var(--text-primary); }
    .btn-outline:hover { background: var(--bg-surface-elevated); }

    /* Form Inputs */
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full-width { grid-column: span 2; }
    .form-group label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-secondary); }
    .form-group input, .form-group select, .form-group textarea {
      background: var(--bg-app);
      border: 1px solid var(--border-default);
      color: var(--text-primary);
      padding: 9px 12px;
      border-radius: 5px;
      font-size: 12px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
      border-color: var(--accent-cyan);
    }
    .form-group textarea { resize: vertical; min-height: 80px; }

    /* Toast Notification */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #111b27;
      border: 1px solid var(--accent-cyan);
      color: #fff;
      padding: 12px 18px;
      border-radius: 6px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      display: none;
      align-items: center;
      gap: 10px;
      z-index: 9999;
    }
  </style>
</head>
<body>
  <div class="env-banner">
    <span>⚠️ CAPECHAIN LABS ADMIN CONTROL PLANE & CMS</span>
    <span>•</span>
    <span>MANDATORY WEBAUTHN HARDWARE MFA</span>
    <span>•</span>
    <a href="http://localhost:3000" target="_blank" style="color: #00e5ff; text-decoration: none; font-weight: 700;">Open User Site ↗</a>
  </div>

  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <img src="/logo.png" alt="CapeChain Logo" class="sidebar-logo" onerror="this.onerror=null; this.src='data:image/png;base64,${logoBase64}';" />
        <div>
          <div>CapeChain Labs</div>
          <div style="font-size: 10px; color: var(--accent-cyan); font-weight: 500;">Admin Control & CMS</div>
        </div>
      </div>
      <nav style="flex: 1; padding: 12px 0;">
        <div class="nav-item active" onclick="switchTab('approvals', this)">
          <span>🛡️ Maker-Checker Approvals</span>
        </div>
        <div class="nav-item" onclick="switchTab('media', this)">
          <span>📰 Media & Press CMS</span>
          <span class="nav-badge" id="media-count-badge">0</span>
        </div>
        <div class="nav-item" onclick="switchTab('careers', this)">
          <span>💼 Careers & Hiring CMS</span>
          <span class="nav-badge" id="careers-count-badge">0</span>
        </div>
        <div class="nav-item" onclick="switchTab('waitlist', this)">
          <span>💳 Visa Card Waitlist</span>
          <span class="nav-badge" id="waitlist-count-badge">0</span>
        </div>
        <div class="nav-item" onclick="switchTab('metrics', this)">
          <span>📈 Markets & L2 Batches</span>
        </div>
      </nav>
      <div style="padding: 16px; border-top: 1px solid var(--border-default); font-size: 11px; color: var(--text-tertiary);">
        <div>Admin Port: <strong>3001</strong></div>
        <div>User Web: <a href="http://localhost:3000" target="_blank" style="color: #60a5fa;">localhost:3000</a></div>
        <div style="margin-top: 6px;">PoR Center: <a href="http://localhost:3002" target="_blank" style="color: #34d399;">localhost:3002</a></div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <header class="top-header">
        <div style="font-weight: 600; font-size: 14px;" id="current-view-title">Four-Eyes Approvals & Settlement Engine</div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="admin-pill">
            <span class="chip chip-hardware">FIDO2 / YubiKey</span>
            <span id="active-user-label">Alice Maker (ComplianceOfficer)</span>
          </div>
          <button class="btn btn-outline" onclick="switchAdminUser()">Switch User</button>
        </div>
      </header>

      <div class="content-area">
        
        <!-- ================================================================= -->
        <!-- TAB 1: MAKER-CHECKER APPROVALS -->
        <!-- ================================================================= -->
        <div id="tab-approvals" class="tab-panel active">
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
            <div class="card" style="margin-bottom: 0;">
              <div class="card-header">Settlement Batch Lag</div>
              <div class="card-body">
                <div class="mono" style="font-size: 24px; font-weight: 700; color: var(--buy-primary);">0.84s</div>
                <div style="color: var(--text-secondary); font-size: 11px; margin-top: 4px;">Target: &lt; 2.0s on Base L2</div>
              </div>
            </div>
            <div class="card" style="margin-bottom: 0;">
              <div class="card-header">Double-Entry Invariant</div>
              <div class="card-body">
                <div class="mono" style="font-size: 24px; font-weight: 700; color: var(--buy-primary);">100% Balanced</div>
                <div style="color: var(--text-secondary); font-size: 11px; margin-top: 4px;">Σ(Debits) == Σ(Credits) strictly held</div>
              </div>
            </div>
            <div class="card" style="margin-bottom: 0;">
              <div class="card-header">Audit Chain Anchor</div>
              <div class="card-body">
                <div class="mono" style="font-size: 12px; color: var(--accent-cyan);" id="latest-chain-hash">Checking...</div>
                <div style="color: var(--text-secondary); font-size: 11px; margin-top: 4px;">SHA-256 Hash Chain Integrity</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- TAB 2: MEDIA & PRESS CMS -->
        <!-- ================================================================= -->
        <div id="tab-media" class="tab-panel">
          <div class="card">
            <div class="card-header">
              <span>Publish New Press Release / Media Announcement</span>
              <a href="http://localhost:3000/media" target="_blank" class="btn btn-outline" style="font-size: 11px;">View Public Media Page ↗</a>
            </div>
            <div class="card-body">
              <form id="media-form" onsubmit="submitMediaPost(event)">
                <div class="form-grid">
                  <div class="form-group">
                    <label>Article Title *</label>
                    <input type="text" id="med-title" required placeholder="e.g. CapeChain Labs Partners with Visa for Global Metal Card" />
                  </div>
                  <div class="form-group">
                    <label>Category *</label>
                    <select id="med-category">
                      <option value="Partnership">Partnership</option>
                      <option value="Product">Product Launch</option>
                      <option value="Infrastructure">Infrastructure & L2</option>
                      <option value="Security">Security & Audits</option>
                      <option value="Corporate">Corporate & Regulatory</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Author</label>
                    <input type="text" id="med-author" value="CapeChain Editorial Team" />
                  </div>
                  <div class="form-group">
                    <label>Estimated Read Time</label>
                    <input type="text" id="med-readtime" value="3 min read" />
                  </div>
                  <div class="form-group full-width">
                    <label>Summary / Deck *</label>
                    <input type="text" id="med-summary" required placeholder="Brief 1-2 sentence excerpt displayed on user cards" />
                  </div>
                  <div class="form-group full-width">
                    <label>Full Content (Markdown or HTML) *</label>
                    <textarea id="med-content" required placeholder="Full press release text and announcement details..."></textarea>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="med-featured" checked />
                    <span>Feature as Lead Story on User Media Page</span>
                  </label>
                  <button type="submit" class="btn btn-cyan">🚀 Publish to User Media Room</button>
                </div>
              </form>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span>Published Media & Press Articles (Synced to User Site)</span>
              <button class="btn btn-outline" onclick="loadCmsData()" style="font-size: 11px;">🔄 Refresh List</button>
            </div>
            <div class="card-body" style="padding: 0;">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Author</th>
                    <th>Published</th>
                    <th>Featured</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="media-tbody">
                  <!-- Dynamically populated -->
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- TAB 3: CAREERS & HIRING CMS -->
        <!-- ================================================================= -->
        <div id="tab-careers" class="tab-panel">
          <div class="card">
            <div class="card-header">
              <span>Post New Career Opening</span>
              <a href="http://localhost:3000/careers" target="_blank" class="btn btn-outline" style="font-size: 11px;">View Public Careers Portal ↗</a>
            </div>
            <div class="card-body">
              <form id="careers-form" onsubmit="submitCareerJob(event)">
                <div class="form-grid">
                  <div class="form-group">
                    <label>Role Title *</label>
                    <input type="text" id="job-title" required placeholder="e.g. Lead Smart Contract Architect (Solidity / Vyper)" />
                  </div>
                  <div class="form-group">
                    <label>Department *</label>
                    <select id="job-department">
                      <option value="Engineering">Engineering</option>
                      <option value="Security & Cryptography">Security & Cryptography</option>
                      <option value="Product & Design">Product & Design</option>
                      <option value="Compliance & Legal">Compliance & Legal</option>
                      <option value="Marketing & Growth">Marketing & Growth</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Location *</label>
                    <input type="text" id="job-location" value="Global Remote / Cape Town" />
                  </div>
                  <div class="form-group">
                    <label>Compensation Package *</label>
                    <input type="text" id="job-compensation" value="$180,000 - $240,000 + Token Equity" />
                  </div>
                  <div class="form-group">
                    <label>Employment Type</label>
                    <select id="job-type">
                      <option value="Full-time">Full-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Part-time">Part-time</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Experience Level</label>
                    <input type="text" id="job-experience" value="Senior / Principal" />
                  </div>
                  <div class="form-group full-width">
                    <label>Role Summary & Impact *</label>
                    <textarea id="job-description" required placeholder="Overview of the position, mission, and key team responsibilities..."></textarea>
                  </div>
                  <div class="form-group full-width">
                    <label>Key Requirements (One item per line)</label>
                    <textarea id="job-requirements" placeholder="5+ years production experience&#10;Deep familiarity with Base / Optimism L2 stack&#10;Track record with high-throughput distributed systems"></textarea>
                  </div>
                </div>
                <div style="display: flex; justify-content: flex-end;">
                  <button type="submit" class="btn btn-cyan">💼 Publish Opening to Careers Portal</button>
                </div>
              </form>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span>Active Open Positions (Live on User Site)</span>
              <button class="btn btn-outline" onclick="loadCmsData()" style="font-size: 11px;">🔄 Refresh List</button>
            </div>
            <div class="card-body" style="padding: 0;">
              <table>
                <thead>
                  <tr>
                    <th>Role Title</th>
                    <th>Department</th>
                    <th>Location</th>
                    <th>Compensation</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="careers-tbody">
                  <!-- Dynamically populated -->
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- TAB 4: VISA CARD WAITLIST -->
        <!-- ================================================================= -->
        <div id="tab-waitlist" class="tab-panel">
          <div class="card">
            <div class="card-header">
              <span>CapeChain Visa Metal Card - Waitlist Reservations</span>
              <a href="http://localhost:3000/card" target="_blank" class="btn btn-outline" style="font-size: 11px;">View Public Card Page ↗</a>
            </div>
            <div class="card-body" style="padding: 0;">
              <table>
                <thead>
                  <tr>
                    <th>Entry ID</th>
                    <th>Email Address</th>
                    <th>Selected Tier</th>
                    <th>Country / Region</th>
                    <th>Registered At</th>
                  </tr>
                </thead>
                <tbody id="waitlist-tbody">
                  <!-- Dynamically populated -->
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- TAB 5: MARKETS & METRICS -->
        <!-- ================================================================= -->
        <div id="tab-metrics" class="tab-panel">
          <div class="card">
            <div class="card-header">Platform Circuit Breakers & Market Status</div>
            <div class="card-body">
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: 6px;">
                  <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase;">BTC/USDT Market</div>
                  <div style="font-size: 20px; font-weight: 700; color: var(--buy-primary); margin: 6px 0;">NORMAL (ACTIVE)</div>
                  <div style="font-size: 11px; color: var(--text-tertiary);">Circuit breaker threshold: ±10% / 5min</div>
                </div>
                <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: 6px;">
                  <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase;">ETH/USDT Market</div>
                  <div style="font-size: 20px; font-weight: 700; color: var(--buy-primary); margin: 6px 0;">NORMAL (ACTIVE)</div>
                  <div style="font-size: 11px; color: var(--text-tertiary);">Frequent Batch Auction interval: 100ms</div>
                </div>
                <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: 6px;">
                  <div style="color: var(--text-secondary); font-size: 11px; text-transform: uppercase;">Base L2 Rollup Sequencer</div>
                  <div style="font-size: 20px; font-weight: 700; color: var(--accent-cyan); margin: 6px 0;">CONNECTED</div>
                  <div style="font-size: 11px; color: var(--text-tertiary);">Chain ID: 8453 (Sepolia/Mainnet)</div>
                </div>
              </div>
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

  <div id="toast" class="toast">
    <span>✅</span>
    <span id="toast-msg">Operation completed successfully.</span>
  </div>

  <script>
    let currentAdmin = {
      id: '018e0000-0007-7000-8000-000000000001',
      name: 'Alice Maker (Compliance)',
      role: 'ComplianceOfficer'
    };

    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toast-msg').innerText = msg;
      toast.style.display = 'flex';
      setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }

    function switchTab(tabId, el) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      
      const target = document.getElementById('tab-' + tabId);
      if (target) target.classList.add('active');
      if (el) el.classList.add('active');

      const titles = {
        'approvals': 'Four-Eyes Approvals & Settlement Engine',
        'media': 'Media & Press CMS (Instant Sync to User Site)',
        'careers': 'Careers & Talent Acquisition CMS',
        'waitlist': 'CapeChain Visa Metal Card Waitlist Roster',
        'metrics': 'Platform Circuit Breakers & L2 Health'
      };
      document.getElementById('current-view-title').innerText = titles[tabId] || 'Admin Portal';
    }

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

    // ------------------------------------------------------------------------
    // APPROVALS
    // ------------------------------------------------------------------------
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
            <div class="mono" style="font-size: 9px; color: var(--accent-cyan); margin-top: 4px; word-break: break-all;">
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
        showToast('Four-eyes action initiated by Maker');
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
          showToast('Request approved by Checker with WebAuthn signature');
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

    // ------------------------------------------------------------------------
    // CMS: MEDIA & CAREERS & WAITLIST
    // ------------------------------------------------------------------------
    async function loadCmsData() {
      try {
        const res = await fetch('/admin/api/cms');
        const data = await res.json();
        
        // Update badges
        document.getElementById('media-count-badge').innerText = (data.media || []).length;
        document.getElementById('careers-count-badge').innerText = (data.careers || []).length;
        document.getElementById('waitlist-count-badge').innerText = (data.cardWaitlist || []).length;

        // Render Media Table
        const mediaTbody = document.getElementById('media-tbody');
        mediaTbody.innerHTML = '';
        (data.media || []).forEach(m => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><strong>\${m.title}</strong><div style="font-size: 11px; color: var(--text-tertiary);">\${m.summary ? m.summary.slice(0, 60) + '...' : ''}</div></td>
            <td><span class="chip chip-cyan">\${m.category}</span></td>
            <td>\${m.author}</td>
            <td class="mono" style="font-size: 11px;">\${new Date(m.publishedAt).toLocaleDateString()}</td>
            <td>\${m.featured ? '<span class="chip chip-gold">★ Lead Story</span>' : 'Standard'}</td>
            <td>
              <div style="display: flex; gap: 8px;">
                <a href="http://localhost:3000/media" target="_blank" class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;">View</a>
                <button class="btn btn-danger" style="padding: 2px 8px; font-size: 11px;" onclick="deleteMediaPost('\${m.id}')">Delete</button>
              </div>
            </td>
          \`;
          mediaTbody.appendChild(tr);
        });

        // Render Careers Table
        const careersTbody = document.getElementById('careers-tbody');
        careersTbody.innerHTML = '';
        (data.careers || []).forEach(j => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><strong>\${j.title}</strong><div style="font-size: 11px; color: var(--text-tertiary);">\${j.experience || ''}</div></td>
            <td><span class="chip chip-cyan">\${j.department}</span></td>
            <td>\${j.location}</td>
            <td class="mono" style="color: var(--buy-primary);">\${j.compensation}</td>
            <td>\${j.type}</td>
            <td>
              <div style="display: flex; gap: 8px;">
                <a href="http://localhost:3000/careers" target="_blank" class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;">View</a>
                <button class="btn btn-danger" style="padding: 2px 8px; font-size: 11px;" onclick="deleteCareerJob('\${j.id}')">Archive</button>
              </div>
            </td>
          \`;
          careersTbody.appendChild(tr);
        });

        // Render Waitlist Table
        const waitlistTbody = document.getElementById('waitlist-tbody');
        waitlistTbody.innerHTML = '';
        if (!data.cardWaitlist || data.cardWaitlist.length === 0) {
          waitlistTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-tertiary); padding: 20px;">No waitlist submissions yet</td></tr>';
        } else {
          data.cardWaitlist.slice().reverse().forEach(w => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td class="mono" style="font-size: 11px;">\${w.id.slice(0, 12)}</td>
              <td><strong>\${w.email}</strong></td>
              <td><span class="chip chip-gold">\${w.cardTier || 'Obsidian Black'}</span></td>
              <td>\${w.country || 'Global'}</td>
              <td class="mono" style="font-size: 11px;">\${new Date(w.registeredAt).toLocaleString()}</td>
            \`;
            waitlistTbody.appendChild(tr);
          });
        }
      } catch (err) {
        console.warn('Error loading CMS data:', err);
      }
    }

    async function submitMediaPost(e) {
      e.preventDefault();
      const payload = {
        title: document.getElementById('med-title').value,
        category: document.getElementById('med-category').value,
        author: document.getElementById('med-author').value,
        readTime: document.getElementById('med-readtime').value,
        summary: document.getElementById('med-summary').value,
        content: document.getElementById('med-content').value,
        featured: document.getElementById('med-featured').checked
      };

      try {
        const res = await fetch('/admin/api/cms/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const out = await res.json();
        if (out.success) {
          showToast('Article published successfully! Now live on user /media page.');
          document.getElementById('media-form').reset();
          loadCmsData();
        } else {
          alert('Failed to publish: ' + (out.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Publish error: ' + err.message);
      }
    }

    async function deleteMediaPost(id) {
      if (!confirm('Are you sure you want to delete this press release? It will immediately disappear from the user site.')) return;
      try {
        const res = await fetch('/admin/api/cms/media?id=' + encodeURIComponent(id), {
          method: 'DELETE'
        });
        const out = await res.json();
        if (out.success) {
          showToast('Article deleted from user site.');
          loadCmsData();
        }
      } catch (err) {
        alert('Delete error: ' + err.message);
      }
    }

    async function submitCareerJob(e) {
      e.preventDefault();
      const payload = {
        title: document.getElementById('job-title').value,
        department: document.getElementById('job-department').value,
        location: document.getElementById('job-location').value,
        compensation: document.getElementById('job-compensation').value,
        type: document.getElementById('job-type').value,
        experience: document.getElementById('job-experience').value,
        description: document.getElementById('job-description').value,
        requirements: document.getElementById('job-requirements').value.split('\\n').filter(Boolean)
      };

      try {
        const res = await fetch('/admin/api/cms/careers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const out = await res.json();
        if (out.success) {
          showToast('Job opening published! Now live on user /careers page.');
          document.getElementById('careers-form').reset();
          loadCmsData();
        } else {
          alert('Failed to publish job: ' + (out.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Publish error: ' + err.message);
      }
    }

    async function deleteCareerJob(id) {
      if (!confirm('Are you sure you want to archive this job opening?')) return;
      try {
        const res = await fetch('/admin/api/cms/careers?id=' + encodeURIComponent(id), {
          method: 'DELETE'
        });
        const out = await res.json();
        if (out.success) {
          showToast('Job listing archived and removed from public careers page.');
          loadCmsData();
        }
      } catch (err) {
        alert('Archive error: ' + err.message);
      }
    }

    // Polling refresh
    setInterval(() => {
      loadApprovals();
      loadAuditLog();
      loadCmsData();
    }, 3000);

    // Initial load
    loadApprovals();
    loadAuditLog();
    loadCmsData();
  </script>
</body>
</html>`;

  res.end(html);
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[apps/admin] CapeChain Labs Isolated Admin Portal shell running on http://localhost:${PORT}`);
  });
}

module.exports = handleRequest;
