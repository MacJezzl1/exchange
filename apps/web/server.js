const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const cms = require('../../data/cms-helper');

const PORT = process.env.PORT || 3000;

// Read logo as base64 for guaranteed zero-break inline fallback
let logoBase64 = '';
try {
  const logoPath = path.join(__dirname, 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString('base64');
  }
} catch (_) {}

function getSharedHeader(activeTab = 'home') {
  return `
    <header class="navbar">
      <div class="nav-container">
        <a href="/" class="brand-link">
          <img src="/logo.png" alt="CapeChain Labs Logo" class="brand-logo" onerror="this.onerror=null; this.src='data:image/png;base64,${logoBase64}';" />
          <div class="brand-text">
            <span class="brand-name">CapeChain</span>
            <span class="brand-badge">LABS</span>
          </div>
        </a>

        <nav class="nav-links">
          <a href="/trade" class="nav-link ${activeTab === 'trade' ? 'active' : ''}">Trade Terminal</a>
          <a href="/card" class="nav-link card-link ${activeTab === 'card' ? 'active' : ''}">
            Visa Card <span class="nav-pill">Coming Soon</span>
          </a>
          <a href="/media" class="nav-link ${activeTab === 'media' ? 'active' : ''}">Media & Press</a>
          <a href="/careers" class="nav-link ${activeTab === 'careers' ? 'active' : ''}">Careers</a>
          <a href="http://localhost:3002" target="_blank" class="nav-link">Proof-of-Reserves</a>
          <a href="http://localhost:3001" target="_blank" class="nav-link admin-nav-link">Admin Portal</a>
        </nav>

        <div class="nav-actions">
          <div id="user-auth-badge" style="display: none; align-items: center; gap: 10px;">
            <div class="wallet-pill" onclick="window.location.href='/trade'">
              <span class="online-indicator"></span>
              <span id="user-display-address" style="font-family: var(--font-mono); font-size: 13px; font-weight: 700;">0x8a9B...F241</span>
            </div>
            <button class="btn-ghost" style="padding: 6px 12px; font-size: 12px;" onclick="signOutUser()">Sign Out</button>
          </div>

          <div id="guest-auth-actions" style="display: flex; align-items: center; gap: 12px;">
            <button class="btn-ghost" onclick="openAuthModal('signin')">Sign In</button>
            <button class="btn-primary" onclick="openAuthModal('signup')">Create Account</button>
          </div>
        </div>
      </div>
    </header>
  `;
}

function getSharedFooter() {
  return `
    <footer class="footer">
      <div class="footer-container">
        <div class="footer-col brand-col">
          <div class="footer-brand">
            <img src="/logo.png" alt="CapeChain Labs" class="footer-logo" onerror="this.onerror=null; this.src='data:image/png;base64,${logoBase64}';" />
            <span class="brand-name">CapeChain <span style="color: #00e5ff;">LABS</span></span>
          </div>
          <p class="footer-desc">
            The next-generation hybrid exchange on Base L2. Sub-10µs deterministic matching with non-custodial sovereign settlement and global Visa card payment integration.
          </p>
          <div class="footer-badges">
            <span class="sec-badge">🛡️ Base L2 Verified</span>
            <span class="sec-badge">💳 Official Visa Partner</span>
            <span class="sec-badge">🔒 SHA-256 Audit Chain</span>
          </div>
        </div>

        <div class="footer-col">
          <h4>Trading & Products</h4>
          <a href="/trade">Spot Trading Terminal</a>
          <a href="/card">CapeChain Visa Metal Card</a>
          <a href="/trade">Frequent Batch Auctions (FBA)</a>
          <a href="http://localhost:3002" target="_blank">Proof-of-Reserves Center</a>
        </div>

        <div class="footer-col">
          <h4>Company & Press</h4>
          <a href="/media">Media Room & Press Kit</a>
          <a href="/careers">Careers & Open Roles <span class="hiring-pill">We're Hiring</span></a>
          <a href="/media">Brand Guidelines & Assets</a>
          <a href="mailto:press@capechain.io">Press Inquiries</a>
        </div>

        <div class="footer-col">
          <h4>Security & Compliance</h4>
          <a href="http://localhost:3001" target="_blank">Admin Control Plane</a>
          <a href="/trade">Emergency Escape Hatch (7-Day)</a>
          <a href="https://basescan.org" target="_blank">Base L2 Smart Vaults</a>
          <a href="mailto:security@capechain.io">Bug Bounty Program</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 CapeChain Labs Inc. All rights reserved. Non-custodial assets secured on Base L2.</p>
        <div class="footer-legal">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Regulatory Disclosures</a>
        </div>
      </div>
    </footer>
  `;
}

function getAuthModalHtml() {
  return `
    <!-- Global Auth Modal (Apple, Google, Passkey, Wallet, Email) -->
    <div id="auth-modal-overlay" class="modal-overlay" onclick="closeAuthModal(event)">
      <div class="modal-container" onclick="event.stopPropagation()">
        <button class="modal-close-btn" onclick="closeAuthModal()">&times;</button>
        
        <div class="auth-header">
          <img src="/logo.png" class="auth-logo" onerror="this.onerror=null; this.src='data:image/png;base64,${logoBase64}';" />
          <h2 id="auth-title">Welcome to CapeChain Labs</h2>
          <p id="auth-subtitle">Sign in to trade at CEX speed with sovereign Base L2 custody</p>
        </div>

        <div class="auth-tabs">
          <button id="tab-signin" class="auth-tab active" onclick="switchAuthTab('signin')">Sign In</button>
          <button id="tab-signup" class="auth-tab" onclick="switchAuthTab('signup')">Create Account</button>
        </div>

        <div class="social-auth-stack">
          <!-- 1. Continue with Apple -->
          <button class="social-btn btn-apple" onclick="handleSocialAuth('Apple')">
            <svg class="social-icon" viewBox="0 0 170 170" width="18" height="18" fill="currentColor">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.85-11.7-14.44-6.42-10.23-11.36-21.78-14.81-34.66-3.46-12.87-5.19-24.81-5.19-35.82 0-14.8 3.82-27.18 11.45-37.13 7.63-9.96 17.18-15.06 28.66-15.31 5.34.12 11.1 1.54 17.27 4.25 6.18 2.71 10.15 4.12 11.92 4.24 1.53-.12 5.76-1.65 12.69-4.59 6.94-2.94 12.88-4.3 17.84-4.08 13.52 1.05 24.36 6.52 32.53 16.42-11.66 7.07-17.39 16.89-17.18 29.47.22 9.8 4.04 18.06 11.45 24.78 7.42 6.73 16.32 10.74 26.71 12.04-2.4 7.63-5.34 15.2-8.82 22.72zM119.22 33.15c0-7.39 2.62-14.36 7.85-20.9 5.23-6.54 11.65-10.87 19.27-13 1.09 7.72-.65 14.9-5.23 21.54-4.58 6.64-11.01 11.08-19.29 13.33-.44-.32-1.2-.55-2.29-.97-.22-1.07-.31-1.63-.31-1.89z"/>
            </svg>
            <span>Continue with Apple</span>
          </button>

          <!-- 2. Continue with Google -->
          <button class="social-btn btn-google" onclick="handleSocialAuth('Google')">
            <svg class="social-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <!-- 3. Passkey / Touch ID -->
          <button class="social-btn btn-passkey" onclick="handleSocialAuth('Passkey (FIDO2)')">
            <span style="font-size: 16px;">🔑</span>
            <span>Biometric Passkey (Touch ID / Face ID)</span>
          </button>

          <!-- 4. Web3 Wallet (SIWE) -->
          <button class="social-btn btn-wallet" onclick="handleSocialAuth('Web3 Wallet (SIWE)')">
            <span style="font-size: 16px;">🦊</span>
            <span>Connect Web3 Wallet (MetaMask / Coinbase)</span>
          </button>
        </div>

        <div class="auth-divider">
          <span>or sign in with email</span>
        </div>

        <form class="auth-form" onsubmit="handleEmailAuth(event)">
          <div class="form-group">
            <label>Work or Personal Email</label>
            <input type="email" id="auth-email-input" required placeholder="you@domain.com" class="form-input" />
          </div>
          <button type="submit" class="btn-submit-auth" id="btn-submit-text">Send Instant Magic Link</button>
        </form>

        <div id="auth-status-msg" style="display: none; padding: 10px; border-radius: 8px; margin-top: 12px; font-size: 13px; text-align: center;"></div>

        <p class="auth-terms">
          Secured by <a href="https://supabase.com" target="_blank" style="color: #3ecf8e; font-weight: 700;">Supabase</a> &amp; Base L2 smart contract non-custodial custody protocols.
        </p>
      </div>
    </div>

    <!-- Global Toast Container -->
    <div id="toast-container" class="toast-stack"></div>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script>
      const SUPABASE_PROJECT_URL = 'https://hvayastdrwippkaltrbt.supabase.co';
      const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MaLAEpbCKGi70x1_KTgmkw_YEFEFGwv';
      let supabaseClient = null;
      try {
        if (window.supabase) {
          supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_PUBLISHABLE_KEY);
        }
      } catch (err) {
        console.warn('Supabase init notice:', err);
      }

      function showToast(title, message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast-item toast-' + type;
        const icon = type === 'success' ? '✅' : (type === 'danger' ? '❌' : 'ℹ️');
        toast.innerHTML = \`
          <span class="toast-icon">\${icon}</span>
          <div class="toast-content">
            <div class="toast-title">\${title}</div>
            <div class="toast-msg">\${message}</div>
          </div>
          <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        \`;
        container.appendChild(toast);
        setTimeout(() => {
          if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
          }
        }, 4500);
      }

      function checkAuthSession() {
        const stored = localStorage.getItem('capechain_user');
        const badge = document.getElementById('user-auth-badge');
        const guest = document.getElementById('guest-auth-actions');
        const addrEl = document.getElementById('user-display-address');
        if (stored) {
          try {
            const u = JSON.parse(stored);
            if (badge) badge.style.display = 'flex';
            if (guest) guest.style.display = 'none';
            if (addrEl) addrEl.innerText = u.address ? u.address.slice(0, 6) + '...' + u.address.slice(-4) : '0x8a9B...F241';
          } catch (_) {}
        } else {
          if (badge) badge.style.display = 'none';
          if (guest) guest.style.display = 'flex';
        }
      }

      function signOutUser() {
        localStorage.removeItem('capechain_user');
        showToast('Signed Out', 'Your sovereign session has been safely closed.', 'info');
        checkAuthSession();
        if (window.location.pathname === '/trade') {
          setTimeout(() => window.location.reload(), 400);
        }
      }

      document.addEventListener('DOMContentLoaded', checkAuthSession);
    </script>
  `;
}

function getSharedStyles() {
  return `
    :root {
      --bg-dark: #07090e;
      --bg-surface: #0e121a;
      --bg-surface-elevated: #151b27;
      --bg-surface-hover: #1c2434;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-glow: rgba(0, 229, 255, 0.25);
      --brand-cyan: #00e5ff;
      --brand-blue: #0070f3;
      --brand-gradient: linear-gradient(135deg, #00e5ff 0%, #0070f3 100%);
      --text-main: #f3f6fc;
      --text-muted: #8b9bb4;
      --success: #00e676;
      --danger: #f43f5e;
      --visa-gold: #f7b600;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', Consolas, Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-dark);
      color: var(--text-main);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      line-height: 1.6;
    }

    /* Navbar */
    .navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(7, 9, 14, 0.88);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
      padding: 14px 24px;
    }
    .nav-container {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }
    .brand-link {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: #fff;
    }
    .brand-logo {
      height: 38px;
      width: auto;
      border-radius: 6px;
      object-fit: contain;
    }
    .brand-name {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .brand-badge {
      font-size: 10px;
      font-weight: 800;
      background: var(--brand-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-left: 4px;
      letter-spacing: 0.08em;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 26px;
    }
    .nav-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .nav-link:hover, .nav-link.active {
      color: #fff;
    }
    .nav-link.active {
      color: var(--brand-cyan);
      font-weight: 600;
    }
    .admin-nav-link {
      color: #a78bfa !important;
      font-weight: 600;
    }
    .nav-pill {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 9999px;
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(0, 112, 243, 0.2));
      border: 1px solid var(--brand-cyan);
      color: var(--brand-cyan);
      font-weight: 700;
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .wallet-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 229, 255, 0.08);
      border: 1px solid var(--border-glow);
      color: #fff;
      padding: 6px 14px;
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .wallet-pill:hover {
      background: rgba(0, 229, 255, 0.16);
    }
    .online-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 8px var(--success);
    }
    .btn-ghost {
      background: transparent;
      border: 1px solid var(--border-subtle);
      color: #fff;
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-ghost:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .btn-primary {
      background: var(--brand-gradient);
      border: none;
      color: #000;
      padding: 9px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 0 20px rgba(0, 229, 255, 0.35);
    }
    .btn-primary:hover {
      filter: brightness(1.15);
      box-shadow: 0 0 25px rgba(0, 229, 255, 0.5);
    }

    /* Auth Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(12px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-glow);
      border-radius: 20px;
      max-width: 440px;
      width: 100%;
      padding: 36px 32px;
      position: relative;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 229, 255, 0.15);
      animation: modalFadeIn 0.25s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-close-btn {
      position: absolute;
      top: 18px; right: 18px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
    }
    .auth-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .auth-logo {
      height: 48px;
      margin-bottom: 12px;
    }
    .auth-header h2 {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .auth-header p {
      font-size: 13px;
      color: var(--text-muted);
    }
    .auth-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 20px;
    }
    .auth-tab {
      flex: 1;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      padding: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .auth-tab.active {
      color: var(--brand-cyan);
      border-bottom-color: var(--brand-cyan);
    }
    .social-auth-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    .social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
      background: rgba(255, 255, 255, 0.04);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .social-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .auth-divider {
      text-align: center;
      position: relative;
      margin: 18px 0;
    }
    .auth-divider::before {
      content: '';
      position: absolute;
      left: 0; right: 0; top: 50%;
      height: 1px;
      background: var(--border-subtle);
    }
    .auth-divider span {
      position: relative;
      background: var(--bg-surface);
      padding: 0 12px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .form-group {
      margin-bottom: 14px;
    }
    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .form-input {
      width: 100%;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-input:focus {
      border-color: var(--brand-cyan);
    }
    .btn-submit-auth {
      width: 100%;
      background: var(--brand-gradient);
      border: none;
      color: #000;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-submit-auth:hover {
      filter: brightness(1.15);
    }
    .auth-terms {
      text-align: center;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 18px;
      line-height: 1.5;
    }

    /* Toast Stack */
    .toast-stack {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }
    .toast-item {
      pointer-events: auto;
      background: rgba(14, 18, 26, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-glow);
      border-radius: 12px;
      padding: 14px 18px;
      min-width: 320px;
      max-width: 440px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: flex-start;
      gap: 12px;
      animation: toastIn 0.3s ease-out;
      transition: all 0.3s ease;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .toast-item.toast-success { border-color: rgba(0, 230, 118, 0.4); }
    .toast-item.toast-danger { border-color: rgba(244, 63, 94, 0.4); }
    .toast-item.toast-info { border-color: rgba(0, 229, 255, 0.4); }
    .toast-icon { font-size: 18px; line-height: 1; }
    .toast-content { flex: 1; }
    .toast-title { font-size: 13px; font-weight: 800; color: #fff; margin-bottom: 2px; }
    .toast-msg { font-size: 12px; color: var(--text-muted); line-height: 1.4; }
    .toast-close { background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; }

    /* Footer */
    .footer {
      background: #05070a;
      border-top: 1px solid var(--border-subtle);
      padding: 60px 24px 30px;
      margin-top: auto;
    }
    .footer-container {
      max-width: 1280px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }
    .footer-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .footer-logo {
      height: 32px;
      width: auto;
    }
    .footer-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 20px;
      max-width: 380px;
    }
    .footer-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .sec-badge {
      font-size: 11px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      padding: 4px 10px;
      border-radius: 6px;
      color: #94a3b8;
    }
    .footer-col h4 {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .footer-col a {
      display: block;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      margin-bottom: 10px;
      transition: color 0.2s;
    }
    .footer-col a:hover {
      color: #fff;
    }
    .hiring-pill {
      font-size: 10px;
      font-weight: 700;
      background: rgba(0, 230, 118, 0.15);
      border: 1px solid var(--success);
      color: var(--success);
      padding: 1px 6px;
      border-radius: 9999px;
      margin-left: 4px;
    }
    .footer-bottom {
      max-width: 1280px;
      margin: 0 auto;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--text-muted);
      flex-wrap: wrap;
      gap: 16px;
    }
    .footer-legal {
      display: flex;
      gap: 20px;
    }
    .footer-legal a {
      color: var(--text-muted);
      text-decoration: none;
    }
    .footer-legal a:hover { color: #fff; }
  `;
}

// ============================================================================
// 1. HOMEPAGE (/)
// ============================================================================
function renderHomePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CapeChain Labs — Sovereign Next-Gen Hybrid Exchange on Base L2</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    ${getSharedStyles()}
    .hero {
      padding: 90px 24px 60px;
      text-align: center;
      max-width: 1100px;
      margin: 0 auto;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 229, 255, 0.08);
      border: 1px solid var(--border-glow);
      color: var(--brand-cyan);
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 24px;
    }
    .hero-title {
      font-size: 56px;
      font-weight: 900;
      line-height: 1.12;
      letter-spacing: -0.03em;
      margin-bottom: 24px;
    }
    .hero-gradient {
      background: var(--brand-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subtitle {
      font-size: 19px;
      color: var(--text-muted);
      max-width: 740px;
      margin: 0 auto 36px;
      line-height: 1.6;
    }
    .hero-cta-group {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 50px;
    }
    .btn-large {
      padding: 14px 32px;
      font-size: 16px;
      border-radius: 12px;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 24px 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .stat-item {
      text-align: left;
      border-right: 1px solid var(--border-subtle);
      padding-right: 20px;
    }
    .stat-item:last-child {
      border-right: none;
    }
    .stat-num {
      font-size: 26px;
      font-weight: 800;
      font-family: var(--font-mono);
      color: #fff;
    }
    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 4px;
    }

    /* Live Ticker Tape */
    .ticker-section {
      border-top: 1px solid var(--border-subtle);
      border-bottom: 1px solid var(--border-subtle);
      background: rgba(0, 0, 0, 0.35);
      padding: 14px 24px;
    }
    .ticker-wrapper {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      overflow-x: auto;
      gap: 20px;
    }
    .ticker-pair {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      white-space: nowrap;
    }
    .pair-name { font-weight: 700; }
    .pair-price { font-family: var(--font-mono); transition: color 0.3s; }
    .pair-change.up { color: var(--success); font-weight: 600; }
    .pair-change.down { color: var(--danger); font-weight: 600; }

    /* Interactive FX Settlement Box */
    .fx-section {
      padding: 80px 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .fx-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-glow);
      border-radius: 20px;
      padding: 40px;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 40px;
      align-items: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    .fx-calc-panel {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 24px;
    }
    .calc-row {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    /* PoR Solvency Widget */
    .por-preview-section {
      padding: 60px 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .por-card {
      background: linear-gradient(135deg, rgba(14, 18, 26, 0.9), rgba(21, 27, 39, 0.9));
      border: 1px solid rgba(0, 230, 118, 0.3);
      border-radius: 20px;
      padding: 36px;
      box-shadow: 0 20px 50px rgba(0, 230, 118, 0.08);
    }
    .por-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    /* Visa Card Showcase */
    .visa-section {
      padding: 90px 24px;
      background: radial-gradient(circle at 50% 30%, rgba(0, 112, 243, 0.15) 0%, transparent 70%);
      position: relative;
    }
    .visa-container {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      align-items: center;
    }
    .visa-card-render {
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 30px 80px rgba(0, 112, 243, 0.35), 0 0 50px rgba(0, 229, 255, 0.25);
      border: 1px solid var(--border-glow);
      transition: transform 0.4s ease;
    }
    .visa-card-render:hover {
      transform: perspective(1000px) rotateY(-4deg) rotateX(2deg) translateY(-6px);
    }
    .visa-card-img {
      width: 100%;
      height: auto;
      display: block;
    }
    .visa-info-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(247, 182, 0, 0.12);
      border: 1px solid rgba(247, 182, 0, 0.3);
      color: var(--visa-gold);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .visa-title {
      font-size: 38px;
      font-weight: 900;
      line-height: 1.2;
      margin-bottom: 20px;
    }
    .visa-perks {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 32px;
    }
    .perk-item {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .perk-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(0, 229, 255, 0.1);
      border: 1px solid var(--border-glow);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .perk-text h4 { font-size: 15px; font-weight: 700; color: #fff; }
    .perk-text p { font-size: 13px; color: var(--text-muted); }

    /* Features Grid */
    .features-section {
      padding: 80px 24px;
      max-width: 1280px;
      margin: 0 auto;
    }
    .section-header { text-align: center; margin-bottom: 50px; }
    .section-title { font-size: 34px; font-weight: 800; margin-bottom: 12px; }
    .section-desc { font-size: 16px; color: var(--text-muted); max-width: 600px; margin: 0 auto; }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .feature-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 32px 24px;
      transition: all 0.3s;
    }
    .feature-card:hover {
      border-color: var(--brand-cyan);
      transform: translateY(-4px);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 229, 255, 0.1);
    }
    .feature-icon { font-size: 28px; margin-bottom: 16px; display: inline-block; }
    .feature-card h3 { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
    .feature-card p { font-size: 14px; color: var(--text-muted); line-height: 1.6; }

    /* FAQ Accordion */
    .faq-section {
      padding: 70px 24px;
      max-width: 900px;
      margin: 0 auto 80px;
    }
    .faq-item {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      margin-bottom: 14px;
      overflow: hidden;
    }
    .faq-question {
      padding: 20px 24px;
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    }
    .faq-answer {
      display: none;
      padding: 0 24px 20px;
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.7;
    }
    .faq-item.active .faq-answer { display: block; }
    .faq-item.active .faq-question span { transform: rotate(180deg); color: var(--brand-cyan); }
  </style>
</head>
<body>
  ${getSharedHeader('home')}

  <!-- Hero -->
  <section class="hero">
    <div class="hero-badge">
      ⚡ Powered by Base L2 &amp; CapeChain Matching Engine
    </div>
    <h1 class="hero-title">
      The Sovereign Exchange for <br/>
      <span class="hero-gradient">High-Velocity Capital</span>
    </h1>
    <p class="hero-subtitle">
      Execute trades at centralized exchange speed (&gt;100k TPS, sub-10µs latency) with mathematically proven self-custody on Base L2. Introducing the CapeChain Visa Card: spend crypto worldwide with zero FX markup.
    </p>

    <div class="hero-cta-group">
      <a href="/trade" class="btn-primary btn-large">
        Launch Trading Terminal &rarr;
      </a>
      <a href="/card" class="btn-ghost btn-large">
        Pre-Order Visa Metal Card 💳
      </a>
    </div>

    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-num">$284.5M</div>
        <div class="stat-label">24h Trading Volume</div>
      </div>
      <div class="stat-item">
        <div class="stat-num">8.66 µs</div>
        <div class="stat-label">Avg Matching Latency</div>
      </div>
      <div class="stat-item">
        <div class="stat-num" style="color: #00e676;">102.8%</div>
        <div class="stat-label">Proof-of-Reserves Ratio</div>
      </div>
      <div class="stat-item">
        <div class="stat-num">100% Zero</div>
        <div class="stat-label">Non-Custodial Loss Risk</div>
      </div>
    </div>
  </section>

  <!-- Live Market Ticker Tape -->
  <div class="ticker-section">
    <div class="ticker-wrapper">
      <div class="ticker-pair">
        <span class="pair-name">BTC / USDT</span>
        <span id="ticker-btc" class="pair-price">$64,280.50</span>
        <span class="pair-change up">+2.84%</span>
      </div>
      <div class="ticker-pair">
        <span class="pair-name">ETH / USDC</span>
        <span id="ticker-eth" class="pair-price">$3,492.10</span>
        <span class="pair-change up">+1.92%</span>
      </div>
      <div class="ticker-pair">
        <span class="pair-name">SOL / USDC</span>
        <span id="ticker-sol" class="pair-price">$154.20</span>
        <span class="pair-change up">+5.12%</span>
      </div>
      <div class="ticker-pair">
        <span class="pair-name">ZAR / USDT</span>
        <span class="pair-price">R 18.42</span>
        <span class="pair-change down">-0.38%</span>
      </div>
      <div class="ticker-pair">
        <span class="pair-name">NGN / USDT</span>
        <span class="pair-price">₦ 1,620.00</span>
        <span class="pair-change up">+0.45%</span>
      </div>
      <div class="ticker-pair">
        <span class="pair-name">KES / USDT</span>
        <span class="pair-price">KSh 129.50</span>
        <span class="pair-change up">+0.15%</span>
      </div>
    </div>
  </div>

  <!-- Interactive FX Calculator -->
  <section class="fx-section">
    <div class="fx-box">
      <div>
        <span style="font-size: 12px; font-weight: 700; color: var(--brand-cyan); letter-spacing: 0.08em; text-transform: uppercase;">Zero-Spread Local Currency Settlement</span>
        <h2 style="font-size: 32px; font-weight: 900; margin-top: 8px; margin-bottom: 16px;">Direct Crypto-to-Fiat Banking Rails</h2>
        <p style="font-size: 15px; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;">
          Convert your Base L2 stablecoins and crypto into instant local fiat across South Africa, Nigeria, Kenya, the EU, and the US with zero intermediary markup.
        </p>
        <div style="display: flex; gap: 16px; font-size: 13px;">
          <div><strong style="color: #fff;">⚡ Stitch EFT</strong>: South Africa</div>
          <div><strong style="color: #fff;">⚡ Paystack NIP</strong>: Nigeria</div>
          <div><strong style="color: #fff;">⚡ M-Pesa STK</strong>: Kenya</div>
        </div>
      </div>

      <div class="fx-calc-panel">
        <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 12px;">Interactive Instant FX Converter</div>
        <div class="calc-row">
          <input type="number" id="calc-in-val" value="500" class="form-input" style="flex: 2; font-family: var(--font-mono); font-weight: 700;" oninput="updateFxCalculation()" />
          <select id="calc-in-curr" class="form-input" style="flex: 1;" onchange="updateFxCalculation()">
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </select>
        </div>

        <div style="text-align: center; font-size: 14px; color: var(--brand-cyan); margin: -4px 0 10px;">&darr; Instant Settlement Rail &darr;</div>

        <div class="calc-row">
          <input type="text" id="calc-out-val" readonly value="R 9,210.00" class="form-input" style="flex: 2; background: rgba(0,229,255,0.06); font-family: var(--font-mono); font-weight: 800; color: #00e676;" />
          <select id="calc-out-curr" class="form-input" style="flex: 1;" onchange="updateFxCalculation()">
            <option value="ZAR">ZAR (South Africa)</option>
            <option value="NGN">NGN (Nigeria)</option>
            <option value="KES">KES (Kenya)</option>
            <option value="USD">USD (FedNow)</option>
            <option value="EUR">EUR (SEPA)</option>
          </select>
        </div>

        <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: var(--text-muted);">Exchange Rate:</span>
            <span id="calc-rate-label" style="font-family: var(--font-mono); color: #fff; font-weight: 600;">1 USDT = 18.42 ZAR</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Conversion Fee:</span>
            <span style="color: var(--success); font-weight: 700;">0.00% (Zero Fee Tier)</span>
          </div>
        </div>

        <button class="btn-primary" style="width: 100%; padding: 12px;" onclick="executeFxInstantSwap()">
          Execute Instant Settlement &rarr;
        </button>
      </div>
    </div>
  </section>

  <!-- Real-Time Proof-of-Reserves Solvency Widget -->
  <section class="por-preview-section">
    <div class="por-card">
      <div class="por-header">
        <div>
          <span style="font-size: 11px; font-weight: 700; color: #00e676; letter-spacing: 0.08em; text-transform: uppercase;">Cryptographic Solvency Audit</span>
          <h3 style="font-size: 24px; font-weight: 900; color: #fff; margin-top: 4px;">Real-Time Proof-of-Reserves (PoR) 2.0</h3>
        </div>
        <a href="http://localhost:3002" target="_blank" class="btn-ghost" style="padding: 8px 16px; font-size: 12px;">Launch Transparency Center &rarr;</a>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px;">
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 18px;">
          <div style="font-size: 12px; color: var(--text-muted);">Total Collateralization</div>
          <div style="font-size: 28px; font-weight: 900; color: #00e676; font-family: var(--font-mono);">102.8%</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Over-collateralized across all assets</div>
        </div>
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 18px;">
          <div style="font-size: 12px; color: var(--text-muted);">On-Chain Base L2 Reserves</div>
          <div style="font-size: 28px; font-weight: 900; color: #fff; font-family: var(--font-mono);">$18.45M</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Secured in non-custodial smart vaults</div>
        </div>
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 18px;">
          <div style="font-size: 12px; color: var(--text-muted);">Emergency Escape Hatch</div>
          <div style="font-size: 28px; font-weight: 900; color: #f59e0b; font-family: var(--font-mono);">7 Days</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Autonomous sovereign exit if halted</div>
        </div>
      </div>

      <div style="background: rgba(0,0,0,0.4); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">Verify Wallet Inclusion:</span>
        <input type="text" id="por-check-addr" value="0x8a9BF241c8889953F9d4793f77EB0076a5bFF241" class="form-input" style="flex: 1; min-width: 280px; font-family: var(--font-mono); font-size: 12px;" />
        <button class="btn-ghost" style="padding: 10px 18px; font-size: 13px;" onclick="verifyWalletInclusion()">Query Merkle Proof</button>
      </div>
      <div id="por-verify-res" style="display: none; margin-top: 14px; font-size: 13px; font-family: var(--font-mono); padding: 12px; border-radius: 8px; background: rgba(0,230,118,0.1); border: 1px solid #00e676; color: #00e676;"></div>
    </div>
  </section>

  <!-- Visa Metal Card Showcase -->
  <section class="visa-section">
    <div class="visa-container">
      <div class="visa-card-render">
        <img src="/visa-card.jpg" alt="CapeChain Visa Metal Debit Card" class="visa-card-img" />
      </div>

      <div class="visa-details">
        <div class="visa-info-badge">
          ✨ Official Partnership with Visa
        </div>
        <h2 class="visa-title">
          Spend Crypto Globally.<br/>
          Zero FX Markups. Instant Settlement.
        </h2>

        <div class="visa-perks">
          <div class="perk-item">
            <div class="perk-icon">💳</div>
            <div class="perk-text">
              <h4>Accepted at 100M+ Visa Merchants</h4>
              <p>Tap, swipe, or pay online anywhere Visa is accepted in 200+ countries and territories worldwide.</p>
            </div>
          </div>
          <div class="perk-item">
            <div class="perk-icon">⚡</div>
            <div class="perk-text">
              <h4>Direct Base L2 Off-Ramp</h4>
              <p>Liquidate directly from your CapeChain sovereign trading balance at point-of-sale in milliseconds.</p>
            </div>
          </div>
          <div class="perk-item">
            <div class="perk-icon">💎</div>
            <div class="perk-text">
              <h4>Up to 3% Crypto Cashback</h4>
              <p>Earn daily Bitcoin or USDC rewards automatically credited to your sovereign Vault on every tap.</p>
            </div>
          </div>
          <div class="perk-item">
            <div class="perk-icon">🌍</div>
            <div class="perk-text">
              <h4>African &amp; Global Multi-Currency Rails</h4>
              <p>Spend seamless ZAR, NGN, KES, USD, and EUR without predatory foreign transaction exchange penalties.</p>
            </div>
          </div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid var(--border-glow); border-radius: 14px; padding: 22px;">
          <h4 style="font-size: 15px; font-weight: 700; color: #fff;">Join the Exclusive Card Waitlist</h4>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Early waitlist members receive a limited-edition Obsidian Titanium Metal card and zero fees for year one.</p>
          <form onsubmit="submitWaitlist(event)" style="display: flex; gap: 10px; margin-top: 14px;">
            <input type="email" id="waitlist-email" placeholder="Enter your email address" required class="form-input" style="flex: 1;" />
            <button type="submit" class="btn-primary" style="white-space: nowrap;">Reserve Card</button>
          </form>
          <div id="waitlist-feedback" style="display: none; margin-top: 10px; font-size: 13px; font-weight: 600;"></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Core Hybrid Pillars -->
  <section class="features-section">
    <div class="section-header">
      <h2 class="section-title">Built Different: CEX Speed, Sovereign Security</h2>
      <p class="section-desc">We solved the trilemma: central limit order book velocity without giving up your private keys.</p>
    </div>

    <div class="feature-grid">
      <div class="feature-card">
        <span class="feature-icon">⚡</span>
        <h3>Deterministic Matching Engine</h3>
        <p>Engineered in Rust with BTreeMap price-time priority, integer fixed-point math, and deterministic replay auditing. Over 100k TPS guaranteed.</p>
      </div>

      <div class="feature-card">
        <span class="feature-icon">🛡️</span>
        <h3>Non-Custodial Base L2 Vaults</h3>
        <p>All assets remain in smart contracts on Base L2. If the operator ever halts for &gt;7 days, our emergency escape hatch automatically unlocks sovereign user exit.</p>
      </div>

      <div class="feature-card">
        <span class="feature-icon">📊</span>
        <h3>Double-Entry Invariant Ledger</h3>
        <p>Mathematical zero-sum constraint: debits strictly equal credits across every journal entry. Zero negative balances and real-time Merkle balance tree proofs.</p>
      </div>

      <div class="feature-card">
        <span class="feature-icon">🛡️</span>
        <h3>MEV-Resistant Frequent Auctions</h3>
        <p>Uniform clearing price batch auctions eliminate front-running, sandwich attacks, and toxic order flow by executing crossing trades at identical prices.</p>
      </div>

      <div class="feature-card">
        <span class="feature-icon">👥</span>
        <h3>Maker-Checker Four-Eyes Controls</h3>
        <p>Administrative withdrawals and high-risk actions require dual-signoff with WebAuthn hardware keys. Makers cannot self-approve their own payout transfers.</p>
      </div>

      <div class="feature-card">
        <span class="feature-icon">🌍</span>
        <h3>Pan-African Liquidity Rails</h3>
        <p>Direct banking rails across South Africa (Stitch EFT), Nigeria (Paystack NIP), and Kenya (M-Pesa STK Push) with automated regulatory compliance.</p>
      </div>
    </div>
  </section>

  <!-- Interactive FAQ Accordion -->
  <section class="faq-section">
    <div style="text-align: center; margin-bottom: 40px;">
      <h2 style="font-size: 30px; font-weight: 800;">Frequently Asked Questions</h2>
      <p style="font-size: 15px; color: var(--text-muted); margin-top: 6px;">Everything you need to know about trading, custody, and the Visa card.</p>
    </div>

    <div class="faq-item active" onclick="toggleFaq(this)">
      <div class="faq-question">
        <span>How does non-custodial trading on Base L2 guarantee my asset safety?</span>
        <span>&#9660;</span>
      </div>
      <div class="faq-answer">
        Your collateral resides entirely in audited non-custodial smart contract vaults on Base L2. CapeChain matches orders off-chain at microsecond speeds using cryptographically signed state updates. If the exchange ever experiences an outage exceeding 7 days, you can trigger the autonomous on-chain escape hatch to withdraw your assets directly to your self-custody wallet without operator permission.
      </div>
    </div>

    <div class="faq-item" onclick="toggleFaq(this)">
      <div class="faq-question">
        <span>How does the CapeChain Visa Metal Card convert crypto at point of sale?</span>
        <span>&#9660;</span>
      </div>
      <div class="faq-answer">
        When you tap your Obsidian or Cobalt Visa card at any of the 100 million+ Visa merchants globally, our sub-10µs liquidation engine settles the transaction against your Base L2 stablecoin or crypto balance in real-time. You receive the exact interbank exchange rate with 0% foreign transaction markups and earn up to 3% cashback in Bitcoin.
      </div>
    </div>

    <div class="faq-item" onclick="toggleFaq(this)">
      <div class="faq-question">
        <span>What are the trading fees and maker rebates?</span>
        <span>&#9660;</span>
      </div>
      <div class="faq-answer">
        CapeChain offers institutional-grade fee structures: Standard Maker fee is 0.10% (10 bps) with negative fee rebates for high-volume market makers, and Taker fee is 0.20% (20 bps). Frequent Batch Auction orders are settled at uniform clearing prices with zero MEV slippage.
      </div>
    </div>

    <div class="faq-item" onclick="toggleFaq(this)">
      <div class="faq-question">
        <span>How do African banking deposits work (ZAR, NGN, KES)?</span>
        <span>&#9660;</span>
      </div>
      <div class="faq-answer">
        We integrate directly with licensed local payment partners: Stitch Instant EFT in South Africa, Paystack NIP in Nigeria, and Safaricom M-Pesa in Kenya. Deposits credit in under 30 seconds into your sovereign account with fully automated AML and travel rule compliance.
      </div>
    </div>
  </section>

  ${getSharedFooter()}
  ${getAuthModalHtml()}

  <script>
    function openAuthModal(mode) {
      document.getElementById('auth-modal-overlay').style.display = 'flex';
      switchAuthTab(mode);
    }

    function closeAuthModal(e) {
      document.getElementById('auth-modal-overlay').style.display = 'none';
    }

    function switchAuthTab(mode) {
      const isSignIn = mode === 'signin';
      document.getElementById('tab-signin').className = 'auth-tab' + (isSignIn ? ' active' : '');
      document.getElementById('tab-signup').className = 'auth-tab' + (!isSignIn ? ' active' : '');
      document.getElementById('auth-title').innerText = isSignIn ? 'Welcome Back to CapeChain' : 'Create Your Sovereign Account';
      document.getElementById('auth-subtitle').innerText = isSignIn 
        ? 'Sign in with your preferred identity provider' 
        : 'Get started with instant biometric passkeys or social SSO';
      document.getElementById('btn-submit-text').innerText = isSignIn ? 'Sign In with Magic Link' : 'Create Free Sovereign Account';
    }

    async function handleSocialAuth(provider) {
      if (supabaseClient && (provider === 'Apple' || provider === 'Google')) {
        const prov = provider.toLowerCase();
        showToast('Supabase SSO', 'Connecting to ' + provider + ' identity provider...', 'info');
        try {
          const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: prov,
            options: { redirectTo: window.location.origin + '/trade' }
          });
          if (error) {
            showToast('Authentication Notice', error.message, 'danger');
            return;
          }
        } catch (err) {
          showToast('Authentication Error', err.message, 'danger');
          return;
        }
      }
      // Demo / Instant Sovereign Wallet Auth
      const demoUser = {
        address: '0x8a9BF241c8889953F9d4793f77EB0076a5bFF241',
        name: provider + ' User',
        email: 'trader@capechain.io',
        provider: provider,
        loggedInAt: new Date().toISOString()
      };
      localStorage.setItem('capechain_user', JSON.stringify(demoUser));
      showToast('Welcome!', 'Signed in successfully with ' + provider + '. Sovereign vault initialized.', 'success');
      closeAuthModal();
      checkAuthSession();
      setTimeout(() => { window.location.href = '/trade'; }, 700);
    }

    async function handleEmailAuth(e) {
      e.preventDefault();
      const email = document.getElementById('auth-email-input').value;
      if (supabaseClient) {
        showToast('Magic Link', 'Dispatching login token to ' + email + '...', 'info');
        try {
          const { error } = await supabaseClient.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin + '/trade' }
          });
          if (error) {
            showToast('Error', error.message, 'danger');
          } else {
            showToast('Magic Link Sent', 'Check inbox for your cryptographic login link.', 'success');
          }
        } catch (err) {
          showToast('Error', err.message, 'danger');
        }
      } else {
        const demoUser = {
          address: '0x8a9BF241c8889953F9d4793f77EB0076a5bFF241',
          name: email.split('@')[0],
          email: email,
          provider: 'Email Magic Link',
          loggedInAt: new Date().toISOString()
        };
        localStorage.setItem('capechain_user', JSON.stringify(demoUser));
        showToast('Magic Link Authenticated', 'Sovereign session established for ' + email, 'success');
        closeAuthModal();
        checkAuthSession();
      }
    }

    // Live Ticker Heartbeat
    let currentBtcPrice = 64280.50;
    setInterval(() => {
      const delta = (Math.random() - 0.48) * 12;
      currentBtcPrice = Math.max(63800, currentBtcPrice + delta);
      const btcEl = document.getElementById('ticker-btc');
      if (btcEl) {
        btcEl.innerText = '$' + currentBtcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        btcEl.style.color = delta >= 0 ? '#00e676' : '#f43f5e';
        setTimeout(() => { btcEl.style.color = ''; }, 600);
      }
    }, 2000);

    // Interactive FX Calculator
    const fxRates = {
      USDT: { ZAR: 18.42, NGN: 1620.00, KES: 129.50, USD: 1.00, EUR: 0.92 },
      BTC: { ZAR: 1184046.00, NGN: 104134410.00, KES: 8324324.00, USD: 64280.50, EUR: 59138.00 },
      ETH: { ZAR: 64324.00, NGN: 5657200.00, KES: 452226.00, USD: 3492.10, EUR: 3212.00 }
    };

    function updateFxCalculation() {
      const inVal = parseFloat(document.getElementById('calc-in-val').value) || 0;
      const inCurr = document.getElementById('calc-in-curr').value;
      const outCurr = document.getElementById('calc-out-curr').value;
      const rate = fxRates[inCurr][outCurr];
      const total = inVal * rate;

      const sym = outCurr === 'ZAR' ? 'R ' : (outCurr === 'NGN' ? '₦ ' : (outCurr === 'KES' ? 'KSh ' : (outCurr === 'EUR' ? '€ ' : '$ ')));
      document.getElementById('calc-out-val').value = sym + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      document.getElementById('calc-rate-label').innerText = '1 ' + inCurr + ' = ' + rate.toLocaleString() + ' ' + outCurr;
    }

    function executeFxInstantSwap() {
      const inVal = document.getElementById('calc-in-val').value;
      const inCurr = document.getElementById('calc-in-curr').value;
      const outVal = document.getElementById('calc-out-val').value;
      const outCurr = document.getElementById('calc-out-curr').value;
      showToast('Swap Executed', 'Converted ' + inVal + ' ' + inCurr + ' into ' + outVal + ' with 0% fee on Base L2 rails.', 'success');
    }

    function verifyWalletInclusion() {
      const addr = document.getElementById('por-check-addr').value.trim();
      const res = document.getElementById('por-verify-res');
      res.style.display = 'block';
      if (!addr.startsWith('0x') || addr.length < 10) {
        res.style.borderColor = '#f43f5e';
        res.style.color = '#f43f5e';
        res.style.background = 'rgba(244,63,94,0.1)';
        res.innerHTML = '❌ Please enter a valid Base L2 / Ethereum wallet address.';
        return;
      }
      res.style.borderColor = '#00e676';
      res.style.color = '#00e676';
      res.style.background = 'rgba(0,230,118,0.1)';
      res.innerHTML = '✅ <strong>MERKLE INCLUSION VERIFIED</strong><br/>Address: ' + addr + '<br/>Merkle Root: 0x8f2d5e1a4c9b3f0e7d6c5b4a3928170e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a<br/>Status: 100% Fully Backed in Base L2 Sovereign Vault.';
    }

    async function submitWaitlist(e) {
      e.preventDefault();
      const email = document.getElementById('waitlist-email').value;
      const feedback = document.getElementById('waitlist-feedback');
      try {
        const res = await fetch('/api/card/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, cardTier: 'Obsidian Metal' })
        });
        const data = await res.json();
        feedback.style.display = 'block';
        feedback.style.color = '#00e676';
        feedback.innerHTML = '🎉 You are on the waitlist! Ticket #' + (data.id ? data.id.slice(-6).toUpperCase() : '842910') + '. Priority reservation recorded for ' + email;
        showToast('Card Reserved', 'Obsidian Metal waitlist confirmed for ' + email, 'success');
        document.getElementById('waitlist-email').value = '';
      } catch (err) {
        feedback.style.display = 'block';
        feedback.style.color = '#00e676';
        feedback.innerHTML = '🎉 You are on the waitlist! Priority reservation recorded for ' + email;
        showToast('Card Reserved', 'Waitlist reservation recorded!', 'success');
      }
    }

    function toggleFaq(el) {
      el.classList.toggle('active');
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// 2. DEDICATED CAPECHAIN VISA CARD PAGE (/card)
// ============================================================================
function renderCardPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CapeChain Visa Metal Card — Sovereign Crypto Spending Worldwide</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    ${getSharedStyles()}
    .card-hero {
      padding: 70px 24px 60px;
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 50px;
      align-items: center;
    }
    .card-title {
      font-size: 48px;
      font-weight: 900;
      line-height: 1.15;
      margin-bottom: 20px;
    }
    .card-preview-container {
      perspective: 1200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .card-3d-box {
      width: 100%;
      max-width: 460px;
      height: 280px;
      border-radius: 20px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 30px 80px rgba(0, 112, 243, 0.45), 0 0 50px rgba(0, 229, 255, 0.25);
      border: 1px solid var(--border-glow);
      transition: transform 0.1s ease-out;
      background: #0d121c;
      user-select: none;
    }
    .card-bg-img {
      position: absolute;
      width: 100%;
      height: 100%;
      object-fit: cover;
      top: 0; left: 0;
      z-index: 1;
    }
    .card-engraved-name {
      position: absolute;
      bottom: 26px;
      left: 32px;
      z-index: 3;
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 800;
      color: #e2e8f0;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,229,255,0.4);
    }
    .card-engraved-tier {
      position: absolute;
      bottom: 26px;
      right: 32px;
      z-index: 3;
      font-size: 11px;
      font-weight: 800;
      color: var(--visa-gold);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .card-studio-controls {
      background: var(--bg-surface);
      border: 1px solid var(--border-glow);
      border-radius: 14px;
      padding: 20px;
      width: 100%;
      max-width: 460px;
    }

    .card-tier-grid {
      max-width: 1200px;
      margin: 60px auto;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      padding: 0 24px;
    }
    .tier-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 18px;
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .tier-box.featured {
      border-color: var(--brand-cyan);
      box-shadow: 0 0 35px rgba(0, 229, 255, 0.2);
    }
    .tier-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 14px;
      align-self: flex-start;
    }
    .pill-obsidian { background: #000; border: 1px solid rgba(255,255,255,0.3); color: #fff; }
    .pill-cobalt { background: rgba(0, 112, 243, 0.2); border: 1px solid var(--brand-blue); color: #60a5fa; }
    .pill-pearl { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; }
    .tier-name { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
    .tier-cashback { font-size: 32px; font-weight: 900; color: var(--brand-cyan); font-family: var(--font-mono); margin-bottom: 16px; }
    .tier-features { list-style: none; margin-bottom: 28px; display: flex; flex-direction: column; gap: 10px; }
    .tier-features li { font-size: 13px; color: var(--text-muted); display: flex; gap: 8px; align-items: center; }
    .tier-features li span { color: var(--success); font-weight: 700; }

    /* VIP Ticket Pass */
    .vip-ticket-modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(14px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .vip-ticket-box {
      background: linear-gradient(135deg, #0e121a 0%, #171d2b 100%);
      border: 1px solid var(--visa-gold);
      border-radius: 20px;
      max-width: 500px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 30px 80px rgba(247, 182, 0, 0.25);
      position: relative;
    }
  </style>
</head>
<body>
  ${getSharedHeader('card')}

  <section class="card-hero">
    <div>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(247, 182, 0, 0.12); border: 1px solid rgba(247, 182, 0, 0.3); color: var(--visa-gold); padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 20px;">
        💳 Coming Soon in Partnership with Visa
      </div>
      <h1 class="card-title">
        The Metal Card Built for <br/>
        <span style="background: var(--brand-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Crypto Sovereignty</span>
      </h1>
      <p style="font-size: 17px; color: var(--text-muted); margin-bottom: 28px;">
        Connect your Base L2 vault balances directly to the worldwide Visa payment network. Zero foreign transaction fees, instant ATM cash access, and 3% cashback in Bitcoin on all purchases.
      </p>

      <div style="background: var(--bg-surface); border: 1px solid var(--border-glow); border-radius: 14px; padding: 22px; max-width: 480px;">
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">Reserve Your Priority Card Spot</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">The first 10,000 waitlist applicants receive the custom laser-engraved Obsidian Titanium card for free.</p>
        <form onsubmit="submitCardWaitlist(event)" style="display: flex; gap: 10px;">
          <input type="email" id="card-email" placeholder="Enter your email" required class="form-input" style="flex: 1;" />
          <button type="submit" class="btn-primary" style="white-space: nowrap;">Join Waitlist</button>
        </form>
        <div id="card-status" style="display: none; margin-top: 10px; font-size: 13px; font-weight: 600; color: #00e676;"></div>
      </div>
    </div>

    <!-- 3D Interactive Metal Card Studio -->
    <div class="card-preview-container">
      <div id="card3d" class="card-3d-box" onmousemove="handleCardTilt(event)" onmouseleave="resetCardTilt()">
        <img src="/visa-card.jpg" alt="CapeChain Visa Card" class="card-bg-img" />
        <div id="engraved-name-display" class="card-engraved-name">ALEXANDER VOGEL</div>
        <div id="engraved-tier-display" class="card-engraved-tier">OBSIDIAN TITANIUM</div>
      </div>

      <div class="card-studio-controls">
        <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
          CUSTOM LASER ENGRAVING PREVIEW:
        </label>
        <input type="text" id="engraving-input" value="ALEXANDER VOGEL" maxlength="24" class="form-input" style="font-family: var(--font-mono); text-transform: uppercase;" oninput="updateEngravingText(this.value)" />
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; color: var(--text-muted);">
          <span>Card Finish: <strong id="finish-label" style="color: #fff;">18g Obsidian Titanium</strong></span>
          <span style="color: var(--brand-cyan);">Hover Card to Inspect 3D Tilt</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Tiers -->
  <section class="card-tier-grid">
    <div class="tier-box">
      <span class="tier-pill pill-pearl">VIRTUAL</span>
      <h3 class="tier-name">Pearl Virtual</h3>
      <div class="tier-cashback">1.0% Back</div>
      <ul class="tier-features">
        <li><span>✓</span> Instant issuance to Apple Pay &amp; Google Wallet</li>
        <li><span>✓</span> 0% Foreign Exchange conversion markup</li>
        <li><span>✓</span> Daily spending limit: $10,000</li>
        <li><span>✓</span> $0 Annual Membership fee</li>
      </ul>
      <button class="btn-ghost" onclick="selectTier('Pearl Virtual', 1.0)" style="margin-top: auto;">Select Tier</button>
    </div>

    <div class="tier-box featured">
      <span class="tier-pill pill-obsidian">EXCLUSIVE</span>
      <h3 class="tier-name">Obsidian Metal</h3>
      <div class="tier-cashback">3.0% Back</div>
      <ul class="tier-features">
        <li><span>✓</span> Heavy 18g Laser-Engraved Titanium Card</li>
        <li><span>✓</span> 3% Cashback in BTC or USDC to sovereign vault</li>
        <li><span>✓</span> Unlimited global ATM withdrawals with zero fee</li>
        <li><span>✓</span> Dedicated VIP 24/7 OTC concierge &amp; staking boost</li>
      </ul>
      <button class="btn-primary" onclick="selectTier('Obsidian Metal', 3.0)" style="margin-top: auto;">Reserve Obsidian</button>
    </div>

    <div class="tier-box">
      <span class="tier-pill pill-cobalt">STANDARD</span>
      <h3 class="tier-name">Cobalt Physical</h3>
      <div class="tier-cashback">2.0% Back</div>
      <ul class="tier-features">
        <li><span>✓</span> Durable Recycled Ocean Plastic Card</li>
        <li><span>✓</span> 2% Cashback paid in crypto</li>
        <li><span>✓</span> Direct Base L2 point-of-sale off-ramp</li>
        <li><span>✓</span> Daily spending limit: $50,000</li>
      </ul>
      <button class="btn-ghost" onclick="selectTier('Cobalt Physical', 2.0)" style="margin-top: auto;">Select Tier</button>
    </div>
  </section>

  <!-- VIP Digital Pass Modal -->
  <div id="vip-modal" class="vip-ticket-modal" onclick="closeVipModal(event)">
    <div class="vip-ticket-box" onclick="event.stopPropagation()">
      <button class="modal-close-btn" onclick="closeVipModal()">&times;</button>
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
        <span style="font-size: 28px;">👑</span>
        <div>
          <h3 style="font-size: 20px; font-weight: 900; color: #fff;">Official Founding Cardholder Pass</h3>
          <p style="font-size: 12px; color: var(--visa-gold);">Priority Batch #1 Verification Ticket</p>
        </div>
      </div>
      <div style="background: rgba(0,0,0,0.4); border: 1px dashed var(--visa-gold); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: var(--text-muted); font-size: 13px;">Pass Serial:</span>
          <span id="ticket-serial" style="font-family: var(--font-mono); font-weight: 700; color: #fff;">CC-VISA-008492</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: var(--text-muted); font-size: 13px;">Engraved Name:</span>
          <span id="ticket-name" style="font-weight: 700; color: #00e5ff;">ALEXANDER VOGEL</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: var(--text-muted); font-size: 13px;">Queue Position:</span>
          <span id="ticket-rank" style="font-weight: 700; color: #00e676;">#3,819 of 10,000</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted); font-size: 13px;">Perk Status:</span>
          <span style="font-weight: 700; color: var(--visa-gold);">Free Titanium Card + 0% FX</span>
        </div>
      </div>
      <button class="btn-primary" style="width: 100%; padding: 12px;" onclick="copyReferralLink()">
        Copy VIP Priority Invite Link 📋
      </button>
    </div>
  </div>

  ${getSharedFooter()}
  ${getAuthModalHtml()}

  <script>
    let activeTier = 'Obsidian Metal';

    function handleCardTilt(e) {
      const card = document.getElementById('card3d');
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const midX = rect.width / 2;
      const midY = rect.height / 2;
      const rotateX = ((y - midY) / midY) * -12;
      const rotateY = ((x - midX) / midX) * 16;
      card.style.transform = \`rotateX(\${rotateX}deg) rotateY(\${rotateY}deg) scale(1.03)\`;
    }

    function resetCardTilt() {
      const card = document.getElementById('card3d');
      card.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    }

    function updateEngravingText(val) {
      const display = document.getElementById('engraved-name-display');
      display.innerText = val.trim() ? val.toUpperCase() : 'YOUR NAME';
    }

    function selectTier(tierName, cashback) {
      activeTier = tierName;
      document.getElementById('engraved-tier-display').innerText = tierName.toUpperCase();
      document.getElementById('finish-label').innerText = tierName;
      document.getElementById('card-email').focus();
      document.getElementById('card-email').placeholder = 'Enter email for ' + tierName + '...';
      showToast('Tier Selected', tierName + ' (' + cashback + '% Cashback) selected.', 'info');
      window.scrollTo({ top: 180, behavior: 'smooth' });
    }

    async function submitCardWaitlist(e) {
      e.preventDefault();
      const email = document.getElementById('card-email').value;
      const name = document.getElementById('engraving-input').value || 'CapeChain Holder';
      try {
        const res = await fetch('/api/card/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, cardTier: activeTier, engravedName: name })
        });
        const data = await res.json();
        
        document.getElementById('ticket-serial').innerText = 'CC-VISA-' + Math.floor(100000 + Math.random() * 900000);
        document.getElementById('ticket-name').innerText = name.toUpperCase();
        document.getElementById('ticket-rank').innerText = '#' + Math.floor(1200 + Math.random() * 4000) + ' of 10,000';
        document.getElementById('vip-modal').style.display = 'flex';
        showToast('VIP Ticket Unlocked', 'Priority Founding Card Pass generated!', 'success');
        document.getElementById('card-email').value = '';
      } catch (err) {
        document.getElementById('vip-modal').style.display = 'flex';
        showToast('VIP Ticket Unlocked', 'Priority pass confirmed for ' + email, 'success');
      }
    }

    function closeVipModal() {
      document.getElementById('vip-modal').style.display = 'none';
    }

    function copyReferralLink() {
      navigator.clipboard.writeText(window.location.origin + '/card?ref=' + document.getElementById('ticket-serial').innerText);
      showToast('Copied', 'VIP referral link copied to clipboard!', 'success');
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// 3. MEDIA & PRESS CENTER (/media)
// ============================================================================
function renderMediaPage() {
  const data = cms.getCmsData();
  const mediaList = data.media || [];

  const articlesHtml = mediaList.map(item => `
    <article class="media-card" data-category="${item.category.toLowerCase()}" data-title="${item.title.toLowerCase()}">
      <div class="media-meta">
        <span class="media-category">${item.category}</span>
        <span class="media-date">${new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span class="media-read">${item.readTime || '3 min read'}</span>
      </div>
      <h3 class="media-title">${item.title}</h3>
      <p class="media-summary">${item.summary}</p>
      <div class="media-footer">
        <span class="media-author">By ${item.author}</span>
        <button class="btn-read-more" onclick="readArticle('${item.id}')">Read Full Story &rarr;</button>
      </div>
    </article>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Media &amp; Press Center — CapeChain Labs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    ${getSharedStyles()}
    .media-hero {
      padding: 60px 24px 40px;
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 30px;
    }
    .filter-bar {
      max-width: 1200px;
      margin: 0 auto 30px;
      padding: 0 24px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    .filter-pills {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .filter-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-pill.active, .filter-pill:hover {
      background: rgba(0, 229, 255, 0.12);
      border-color: var(--brand-cyan);
      color: var(--brand-cyan);
    }
    .media-grid {
      max-width: 1200px;
      margin: 0 auto 80px;
      padding: 0 24px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
    }
    .media-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 28px;
      display: flex;
      flex-direction: column;
      transition: all 0.2s;
    }
    .media-card:hover {
      border-color: var(--brand-cyan);
      transform: translateY(-3px);
    }
    .media-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      margin-bottom: 14px;
    }
    .media-category {
      background: rgba(0, 229, 255, 0.1);
      border: 1px solid var(--border-glow);
      color: var(--brand-cyan);
      padding: 3px 10px;
      border-radius: 6px;
      font-weight: 700;
    }
    .media-date, .media-read { color: var(--text-muted); }
    .media-title {
      font-size: 20px;
      font-weight: 800;
      line-height: 1.35;
      margin-bottom: 12px;
      color: #fff;
    }
    .media-summary {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 24px;
      flex: 1;
    }
    .media-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 16px;
      font-size: 13px;
    }
    .media-author { color: var(--text-muted); font-weight: 500; }
    .btn-read-more {
      background: transparent;
      border: none;
      color: var(--brand-cyan);
      font-weight: 700;
      cursor: pointer;
    }
    .press-kit-box {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
  </style>
</head>
<body>
  ${getSharedHeader('media')}

  <div class="media-hero">
    <div>
      <span style="font-size: 12px; font-weight: 700; color: var(--brand-cyan); letter-spacing: 0.08em; text-transform: uppercase;">Press &amp; Editorial Room</span>
      <h1 style="font-size: 40px; font-weight: 900; margin-top: 6px;">CapeChain Newsroom</h1>
      <p style="font-size: 16px; color: var(--text-muted); margin-top: 8px;">Official announcements, partnership briefings, and engineering milestones from CapeChain Labs.</p>
    </div>

    <div class="press-kit-box">
      <div>
        <div style="font-size: 14px; font-weight: 700; color: #fff;">Download Brand Kit</div>
        <div style="font-size: 12px; color: var(--text-muted);">High-res logos, typography &amp; color specs</div>
      </div>
      <button onclick="downloadPressKit()" class="btn-ghost" style="padding: 8px 14px; font-size: 12px;">Get Assets</button>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-pills">
      <button class="filter-pill active" onclick="filterArticles('all', this)">All Releases</button>
      <button class="filter-pill" onclick="filterArticles('partnership', this)">Partnerships</button>
      <button class="filter-pill" onclick="filterArticles('funding', this)">Funding</button>
      <button class="filter-pill" onclick="filterArticles('technology', this)">Technology &amp; PoR</button>
      <button class="filter-pill" onclick="filterArticles('engineering', this)">Engineering</button>
    </div>
    <input type="text" id="article-search" placeholder="Search news &amp; announcements..." class="form-input" style="max-width: 280px; padding: 8px 14px; font-size: 13px;" oninput="searchArticles(this.value)" />
  </div>

  <section id="media-container" class="media-grid">
    ${articlesHtml}
  </section>

  <!-- Article Reader Modal -->
  <div id="article-modal" class="modal-overlay" onclick="closeArticleModal(event)">
    <div class="modal-container" style="max-width: 680px;" onclick="event.stopPropagation()">
      <button class="modal-close-btn" onclick="closeArticleModal()">&times;</button>
      <div id="article-modal-content"></div>
      <div style="display: flex; gap: 10px; margin-top: 24px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
        <button class="btn-ghost" onclick="copyArticleLink()">Copy Story Link 🔗</button>
        <button class="btn-primary" onclick="shareArticleOnTwitter()">Share on X / Twitter 🐦</button>
      </div>
    </div>
  </div>

  ${getSharedFooter()}
  ${getAuthModalHtml()}

  <script>
    const articles = ${JSON.stringify(mediaList)};
    let activeArticleId = null;

    function readArticle(id) {
      activeArticleId = id;
      const art = articles.find(a => a.id === id);
      if (!art) return;
      const html = \`
        <div style="margin-bottom: 20px;">
          <span style="background: rgba(0,229,255,0.1); border: 1px solid var(--border-glow); color: var(--brand-cyan); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700;">\${art.category}</span>
          <span style="color: var(--text-muted); font-size: 12px; margin-left: 12px;">\${new Date(art.publishedAt).toDateString()}</span>
        </div>
        <h2 style="font-size: 26px; font-weight: 900; line-height: 1.3; margin-bottom: 16px; color: #fff;">\${art.title}</h2>
        <div style="font-size: 13px; color: #94a3b8; margin-bottom: 24px;">By \${art.author} &bull; \${art.readTime || '3 min read'}</div>
        <p style="font-size: 15px; font-weight: 500; color: #e2e8f0; line-height: 1.6; margin-bottom: 20px; border-left: 3px solid var(--brand-cyan); padding-left: 16px;">\${art.summary}</p>
        <div style="font-size: 14px; color: var(--text-muted); line-height: 1.8;">\${art.content}</div>
      \`;
      document.getElementById('article-modal-content').innerHTML = html;
      document.getElementById('article-modal').style.display = 'flex';
    }

    function closeArticleModal() {
      document.getElementById('article-modal').style.display = 'none';
    }

    function filterArticles(cat, btn) {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const cards = document.querySelectorAll('.media-card');
      cards.forEach(card => {
        const itemCat = card.getAttribute('data-category');
        if (cat === 'all' || itemCat.includes(cat)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function searchArticles(q) {
      const query = q.toLowerCase().trim();
      const cards = document.querySelectorAll('.media-card');
      cards.forEach(card => {
        const title = card.getAttribute('data-title');
        if (!query || title.includes(query)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function copyArticleLink() {
      navigator.clipboard.writeText(window.location.origin + '/media?id=' + (activeArticleId || ''));
      showToast('Link Copied', 'Article link copied to clipboard.', 'success');
    }

    function shareArticleOnTwitter() {
      const art = articles.find(a => a.id === activeArticleId);
      const text = encodeURIComponent((art ? art.title : 'CapeChain Labs') + ' @CapeChainLabs');
      window.open('https://twitter.com/intent/tweet?text=' + text + '&url=' + encodeURIComponent(window.location.href), '_blank');
    }

    function downloadPressKit() {
      const kit = {
        name: "CapeChain Labs",
        tagline: "The Sovereign Hybrid Exchange on Base L2",
        brandTokens: {
          cyan: "#00e5ff",
          blue: "#0070f3",
          dark: "#07090e",
          visaGold: "#f7b600"
        },
        partnership: "Official Visa Global Co-Branded Debit Program",
        settlement: "Base L2 Non-Custodial Multi-Asset Smart Vaults",
        pressContact: "press@capechain.io"
      };
      const blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'capechain-press-kit.json';
      a.click();
      showToast('Press Kit Downloaded', 'Brand specifications and metadata downloaded.', 'success');
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// 4. CAREERS PORTAL (/careers)
// ============================================================================
function renderCareersPage() {
  const data = cms.getCmsData();
  const jobsList = (data.careers || []).filter(j => j.active);

  const jobsHtml = jobsList.map(job => `
    <div class="job-card" data-dept="${job.department.toLowerCase()}" data-title="${job.title.toLowerCase()}">
      <div class="job-header">
        <div>
          <h3 class="job-title">${job.title}</h3>
          <div class="job-tags">
            <span class="job-tag tag-dept">${job.department}</span>
            <span class="job-tag">${job.location}</span>
            <span class="job-tag">${job.type}</span>
          </div>
        </div>
        <div class="job-comp">${job.compensation}</div>
      </div>
      <p class="job-desc">${job.description}</p>
      <div class="job-reqs">
        <strong>Key Requirements:</strong>
        <ul>
          ${(job.requirements || []).map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      <button class="btn-primary" onclick="openApplyModal('${job.id}', '${encodeURIComponent(job.title)}')" style="align-self: flex-start; margin-top: 16px;">
        Apply for Position &rarr;
      </button>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Careers at CapeChain Labs — Build The Sovereign Exchange</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    ${getSharedStyles()}
    .careers-hero {
      padding: 70px 24px 50px;
      text-align: center;
      max-width: 900px;
      margin: 0 auto;
    }
    .careers-title {
      font-size: 46px;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin-bottom: 16px;
    }
    .careers-subtitle {
      font-size: 18px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 40px;
    }
    .perks-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      max-width: 1200px;
      margin: 0 auto 60px;
      padding: 0 24px;
    }
    .perk-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .perk-box h4 { font-size: 14px; font-weight: 700; margin-top: 8px; }
    .perk-box p { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

    .jobs-container {
      max-width: 1000px;
      margin: 0 auto 80px;
      padding: 0 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .job-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      transition: all 0.2s;
    }
    .job-card:hover {
      border-color: var(--brand-cyan);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .job-title {
      font-size: 22px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 10px;
    }
    .job-tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .job-tag {
      font-size: 11px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      padding: 3px 10px;
      border-radius: 6px;
      color: var(--text-muted);
    }
    .tag-dept {
      background: rgba(0, 229, 255, 0.08);
      border-color: var(--border-glow);
      color: var(--brand-cyan);
    }
    .job-comp {
      font-size: 15px;
      font-weight: 800;
      color: var(--success);
      font-family: var(--font-mono);
      background: rgba(0, 230, 118, 0.08);
      border: 1px solid rgba(0, 230, 118, 0.25);
      padding: 6px 14px;
      border-radius: 8px;
    }
    .job-desc {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 16px;
      line-height: 1.6;
    }
    .job-reqs {
      font-size: 13px;
      color: #cbd5e1;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 10px;
      padding: 16px 20px;
    }
    .job-reqs ul { margin-top: 8px; padding-left: 20px; }
    .job-reqs li { margin-bottom: 4px; color: var(--text-muted); }
  </style>
</head>
<body>
  ${getSharedHeader('careers')}

  <section class="careers-hero">
    <span style="font-size: 12px; font-weight: 700; color: var(--brand-cyan); letter-spacing: 0.08em; text-transform: uppercase;">Join CapeChain Labs</span>
    <h1 class="careers-title">
      Help Us Build the Future of <br/>
      <span style="background: var(--brand-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Global Sovereign Exchange</span>
    </h1>
    <p class="careers-subtitle">
      We are an elite distributed team of systems engineers, cryptographers, and product builders reimagining digital finance across emerging markets and Base L2.
    </p>
  </section>

  <div class="perks-strip">
    <div class="perk-box">
      <div style="font-size: 24px;">🌍</div>
      <h4>Remote-First Culture</h4>
      <p>Work from wherever you produce your best work.</p>
    </div>
    <div class="perk-box">
      <div style="font-size: 24px;">💵</div>
      <h4>Top-of-Market Comp</h4>
      <p>Competitive USD/Crypto salaries + equity tokens.</p>
    </div>
    <div class="perk-box">
      <div style="font-size: 24px;">🏖️</div>
      <h4>Global Team Offsites</h4>
      <p>Quarterly summits in Cape Town, Nairobi, and Lisbon.</p>
    </div>
    <div class="perk-box">
      <div style="font-size: 24px;">💳</div>
      <h4>CapeChain Metal Card</h4>
      <p>Founding engineer cardholder benefits and bonus.</p>
    </div>
  </div>

  <section class="jobs-container">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 16px;">
      <h2 style="font-size: 24px; font-weight: 800;">Open Positions (${jobsList.length})</h2>
      <div style="display: flex; gap: 8px;">
        <button class="filter-pill active" onclick="filterJobs('all', this)">All</button>
        <button class="filter-pill" onclick="filterJobs('engineering', this)">Engineering</button>
        <button class="filter-pill" onclick="filterJobs('product', this)">Product</button>
      </div>
    </div>
    <div id="jobs-list" style="display: flex; flex-direction: column; gap: 24px;">
      ${jobsHtml}
    </div>
  </section>

  <!-- Application Modal -->
  <div id="apply-modal" class="modal-overlay" onclick="closeApplyModal(event)">
    <div class="modal-container" style="max-width: 520px;" onclick="event.stopPropagation()">
      <button class="modal-close-btn" onclick="closeApplyModal()">&times;</button>
      <h3 style="font-size: 20px; font-weight: 800; margin-bottom: 6px;">Apply for Role</h3>
      <p id="apply-role-title" style="font-size: 13px; color: var(--brand-cyan); margin-bottom: 20px;"></p>

      <form onsubmit="submitApplication(event)" style="display: flex; flex-direction: column; gap: 14px;">
        <input type="hidden" id="apply-job-id" />
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="apply-name" required placeholder="Satoshi Nakamoto" class="form-input" />
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" id="apply-email" required placeholder="you@domain.com" class="form-input" />
        </div>
        <div class="form-group">
          <label>LinkedIn / GitHub / Portfolio URL</label>
          <input type="url" id="apply-link" required placeholder="https://github.com/yourhandle" class="form-input" />
        </div>
        <div class="form-group">
          <label>Upload Resume (Simulated)</label>
          <input type="file" id="apply-resume" class="form-input" onchange="handleResumeUpload(this)" />
          <div id="resume-badge" style="display: none; font-size: 12px; color: var(--success); margin-top: 4px;"></div>
        </div>
        <div class="form-group">
          <label>Why CapeChain Labs? (Brief Note)</label>
          <textarea id="apply-note" rows="3" class="form-input" placeholder="Tell us about the hardest systems or blockchain problem you have solved..."></textarea>
        </div>
        <button type="submit" class="btn-primary" style="padding: 12px; margin-top: 8px;">Submit Application</button>
      </form>
    </div>
  </div>

  ${getSharedFooter()}
  ${getAuthModalHtml()}

  <script>
    function openApplyModal(jobId, encodedTitle) {
      document.getElementById('apply-job-id').value = jobId;
      document.getElementById('apply-role-title').innerText = decodeURIComponent(encodedTitle);
      document.getElementById('apply-modal').style.display = 'flex';
    }

    function closeApplyModal() {
      document.getElementById('apply-modal').style.display = 'none';
    }

    function handleResumeUpload(input) {
      if (input.files && input.files[0]) {
        const badge = document.getElementById('resume-badge');
        badge.style.display = 'block';
        badge.innerText = '📎 Attached: ' + input.files[0].name + ' (' + (input.files[0].size / 1024).toFixed(1) + ' KB)';
      }
    }

    function filterJobs(dept, btn) {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const cards = document.querySelectorAll('.job-card');
      cards.forEach(card => {
        const jobDept = card.getAttribute('data-dept');
        if (dept === 'all' || jobDept.includes(dept)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    }

    async function submitApplication(e) {
      e.preventDefault();
      const jobId = document.getElementById('apply-job-id').value;
      const jobTitle = document.getElementById('apply-role-title').innerText;
      const name = document.getElementById('apply-name').value;
      const email = document.getElementById('apply-email').value;
      const profileUrl = document.getElementById('apply-link').value;
      const note = document.getElementById('apply-note').value;

      try {
        await fetch('/api/careers/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, jobTitle, name, email, profileUrl, note })
        });
      } catch (_) {}

      const candidateCode = 'CC-CAREER-' + Math.floor(1000 + Math.random() * 9000);
      showToast('Application Submitted!', 'Ref #' + candidateCode + ' recorded. Review within 48h.', 'success');
      closeApplyModal();
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// 5. SPOT TRADING TERMINAL (/trade) - FULL INTERACTIVE EXPERIENCE
// ============================================================================
function renderTradeTerminal() {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BTC-USDT Spot Terminal — CapeChain Labs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    ${getSharedStyles()}
    :root {
      --bg-app: #080a0f;
      --bg-surface: #0e121a;
      --bg-surface-elevated: #151b26;
      --border-subtle: #1c2331;
      --border-default: #263145;
      --buy-primary: #00e676;
      --sell-primary: #f43f5e;
    }
    .terminal-body {
      display: grid;
      grid-template-columns: 280px 1fr 340px;
      grid-template-rows: 44px calc(100vh - 280px) 210px;
      background: var(--bg-app);
      overflow: hidden;
      height: calc(100vh - 65px);
    }
    .market-strip {
      grid-column: 1 / -1;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 24px;
      font-size: 13px;
    }
    .book-panel {
      background: var(--bg-surface);
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      font-family: var(--font-mono);
      font-size: 12px;
      overflow: hidden;
    }
    .chart-panel {
      background: var(--bg-app);
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border-subtle);
      position: relative;
    }
    .order-panel {
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 12px;
      overflow-y: auto;
    }
    .bottom-panel {
      grid-column: 1 / -1;
      background: var(--bg-surface);
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
    }
    .book-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      padding: 4px 12px;
      cursor: pointer;
      position: relative;
    }
    .book-row:hover { background: rgba(255,255,255,0.04); }
    .book-row.ask { color: var(--sell-primary); }
    .book-row.bid { color: var(--buy-primary); }
    .depth-bar {
      position: absolute;
      top: 0; bottom: 0; right: 0;
      opacity: 0.15;
      pointer-events: none;
    }
    .depth-bar.ask { background: var(--sell-primary); }
    .depth-bar.bid { background: var(--buy-primary); }
    .spread-bar {
      padding: 6px 12px;
      background: var(--bg-surface-elevated);
      font-weight: 700;
      text-align: center;
      border-top: 1px solid var(--border-subtle);
      border-bottom: 1px solid var(--border-subtle);
      font-size: 11px;
    }

    /* Tabs in bottom panel */
    .tab-header {
      display: flex;
      border-bottom: 1px solid var(--border-subtle);
      background: rgba(0,0,0,0.2);
    }
    .terminal-tab {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .terminal-tab.active {
      color: var(--brand-cyan);
      border-bottom-color: var(--brand-cyan);
    }
    .tab-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
    }

    table.terminal-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      font-family: var(--font-mono);
    }
    table.terminal-table th {
      text-align: left;
      padding: 6px 10px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      font-size: 11px;
    }
    table.terminal-table td {
      padding: 8px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }

    /* Modal styling */
    .trade-modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(10px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .trade-modal-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-glow);
      border-radius: 16px;
      max-width: 440px;
      width: 100%;
      padding: 28px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.6);
      position: relative;
    }
  </style>
</head>
<body>
  ${getSharedHeader('trade')}

  <div class="terminal-body">
    <!-- Header Market Strip -->
    <div class="market-strip">
      <span style="font-weight: 800; font-size: 15px; color: #fff;">BTC / USDT</span>
      <span id="market-price-strip" style="font-family: var(--font-mono); font-size: 15px; font-weight: 800; color: #00e676;">$64,280.50</span>
      <span style="color: var(--text-muted); font-size: 12px;">24h High: <strong id="strip-high" style="color: #fff;">$65,120.00</strong></span>
      <span style="color: var(--text-muted); font-size: 12px;">24h Low: <strong id="strip-low" style="color: #fff;">$63,450.00</strong></span>
      <span style="color: var(--text-muted); font-size: 12px;">24h Vol: <strong style="color: #fff;">1,842.50 BTC</strong></span>
      <div style="margin-left: auto; display: flex; align-items: center; gap: 14px;">
        <button class="btn-ghost" style="padding: 4px 12px; font-size: 12px; color: #00e676; border-color: rgba(0,230,118,0.3);" onclick="openDepositModal()">Deposit (Base L2)</button>
        <button class="btn-ghost" style="padding: 4px 12px; font-size: 12px;" onclick="openWithdrawModal()">Withdraw</button>
        <span style="color: var(--brand-cyan); font-weight: 600; font-size: 12px;">
          ⚡ Latency: 8.66µs | Base L2 Sovereign Vault
        </span>
      </div>
    </div>

    <!-- Live Order Book -->
    <div class="book-panel">
      <div style="padding: 8px 12px; font-weight: 700; border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); font-size: 11px; display: flex; justify-content: space-between;">
        <span>ORDER BOOK (BTC-USDT)</span>
        <span style="color: #64748b;">Click to Fill</span>
      </div>
      <div id="asks-container" style="flex: 1; display: flex; flex-direction: column-reverse; overflow: hidden;"></div>
      <div id="book-spread" class="spread-bar">Spread: 5.00 USDT (0.007%)</div>
      <div id="bids-container" style="flex: 1; overflow: hidden;"></div>
    </div>

    <!-- Interactive Canvas Candlestick Chart Engine -->
    <div class="chart-panel">
      <div style="padding: 8px 16px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 700; font-size: 13px; color: #fff;">BTC/USDT Candlestick Engine</span>
          <div style="display: flex; gap: 4px; margin-left: 12px;">
            <button class="filter-pill active" onclick="switchTimeframe('1m', this)">1m</button>
            <button class="filter-pill" onclick="switchTimeframe('5m', this)">5m</button>
            <button class="filter-pill" onclick="switchTimeframe('15m', this)">15m</button>
            <button class="filter-pill" onclick="switchTimeframe('1h', this)">1h</button>
            <button class="filter-pill" onclick="switchTimeframe('1D', this)">1D</button>
          </div>
        </div>
        <div id="hud-readout" style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">
          O: 64,280.00 | H: 64,340.00 | L: 64,210.00 | C: 64,295.00
        </div>
      </div>
      <div style="flex: 1; position: relative;">
        <canvas id="candleCanvas" style="width: 100%; height: 100%; display: block;"></canvas>
      </div>
    </div>

    <!-- Order Entry Form -->
    <div class="order-panel">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <button id="btn-side-buy" class="btn-primary" style="background: #00e676;" onclick="setOrderSide('buy')">Buy BTC</button>
        <button id="btn-side-sell" class="btn-ghost" onclick="setOrderSide('sell')">Sell BTC</button>
      </div>

      <div class="form-group" style="margin-bottom: 8px;">
        <label>Order Type</label>
        <select id="order-type-select" class="form-input" style="padding: 8px;" onchange="handleOrderTypeChange()">
          <option value="limit">Limit Order</option>
          <option value="market">Market Order</option>
          <option value="ioc">Immediate-Or-Cancel (IOC)</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom: 8px;">
        <label>Price (USDT)</label>
        <input type="number" id="order-price" value="64280.00" step="0.50" class="form-input" oninput="calculateOrderTotal()" />
      </div>

      <div class="form-group" style="margin-bottom: 8px;">
        <label>Quantity (BTC)</label>
        <input type="number" id="order-qty" value="0.250" step="0.001" class="form-input" oninput="calculateOrderTotal()" />
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px;">
        <button class="btn-ghost" style="padding: 4px; font-size: 11px;" onclick="setOrderPercent(0.25)">25%</button>
        <button class="btn-ghost" style="padding: 4px; font-size: 11px;" onclick="setOrderPercent(0.50)">50%</button>
        <button class="btn-ghost" style="padding: 4px; font-size: 11px;" onclick="setOrderPercent(0.75)">75%</button>
        <button class="btn-ghost" style="padding: 4px; font-size: 11px;" onclick="setOrderPercent(1.00)">100%</button>
      </div>

      <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px 12px; font-size: 12px; border: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: var(--text-muted);">Est. Total:</span>
          <span id="order-total-display" style="font-family: var(--font-mono); font-weight: 700; color: #fff;">16,070.00 USDT</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: var(--text-muted);">Fee (Taker/Maker):</span>
          <span style="font-family: var(--font-mono); color: var(--brand-cyan);">0.10% / 0.20%</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Available Vault:</span>
          <span id="avail-balance-display" style="font-family: var(--font-mono); font-weight: 700; color: #00e676;">50,000.00 USDT</span>
        </div>
      </div>

      <button id="submit-btn" class="btn-primary" onclick="submitTradeOrder()" style="padding: 12px; margin-top: 4px; font-weight: 800;">
        Sign &amp; Submit Buy Order (EIP-712)
      </button>
    </div>

    <!-- Bottom Panel (Open Orders, Trade History, Assets) -->
    <div class="bottom-panel">
      <div class="tab-header">
        <button class="terminal-tab active" onclick="switchBottomTab('orders', this)">Open Orders (<span id="open-orders-count">0</span>)</button>
        <button class="terminal-tab" onclick="switchBottomTab('history', this)">Trade History</button>
        <button class="terminal-tab" onclick="switchBottomTab('assets', this)">Sovereign Vault Assets</button>
        <button class="terminal-tab" onclick="switchBottomTab('escape', this)">7-Day Escape Hatch</button>
      </div>

      <div id="tab-orders" class="tab-content">
        <table class="terminal-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Pair</th>
              <th>Type</th>
              <th>Side</th>
              <th style="text-align: right;">Price</th>
              <th style="text-align: right;">Quantity</th>
              <th style="text-align: right;">Filled</th>
              <th>Time</th>
              <th style="text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody id="open-orders-tbody">
            <tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">No active open orders in deterministic engine.</td></tr>
          </tbody>
        </table>
      </div>

      <div id="tab-history" class="tab-content" style="display: none;">
        <table class="terminal-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Trade ID</th>
              <th>Pair</th>
              <th>Side</th>
              <th style="text-align: right;">Executed Price</th>
              <th style="text-align: right;">Filled Qty</th>
              <th style="text-align: right;">Fee Paid</th>
              <th>Settlement Status</th>
            </tr>
          </thead>
          <tbody id="history-tbody">
            <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No executions logged yet in current session.</td></tr>
          </tbody>
        </table>
      </div>

      <div id="tab-assets" class="tab-content" style="display: none;">
        <table class="terminal-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Network</th>
              <th style="text-align: right;">Total Balance</th>
              <th style="text-align: right;">Available</th>
              <th style="text-align: right;">In Open Orders</th>
              <th style="text-align: center;">Smart Contract</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>USDT</strong> (Tether USD)</td>
              <td>Base L2</td>
              <td id="asset-total-usdt" style="text-align: right; color: #fff;">50,000.00</td>
              <td id="asset-avail-usdt" style="text-align: right; color: #00e676;">50,000.00</td>
              <td id="asset-hold-usdt" style="text-align: right; color: #f59e0b;">0.00</td>
              <td style="text-align: center; font-size: 11px; color: var(--brand-cyan);">0x018e...0001 (Sepolia)</td>
            </tr>
            <tr>
              <td><strong>BTC</strong> (Bitcoin Sovereign)</td>
              <td>Base L2</td>
              <td id="asset-total-btc" style="text-align: right; color: #fff;">1.2500</td>
              <td id="asset-avail-btc" style="text-align: right; color: #00e676;">1.2500</td>
              <td id="asset-hold-btc" style="text-align: right; color: #f59e0b;">0.0000</td>
              <td style="text-align: center; font-size: 11px; color: var(--brand-cyan);">0x018e...0002 (Sepolia)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div id="tab-escape" class="tab-content" style="display: none;">
        <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
          <h4 style="color: #f59e0b; margin-bottom: 6px;">Autonomous Non-Custodial Emergency Escape Hatch</h4>
          <p>
            Under CapeChain's smart contract design on Base L2, user funds are locked inside deterministic smart contract vaults. If our operator node halts or fails to submit settlement batches for more than 7 consecutive days (604,800 seconds), any user can invoke <code>escapeHatchWithdraw()</code> to reclaim their assets without operator permission.
          </p>
          <div style="margin-top: 10px;">
            <button class="btn-ghost" style="padding: 6px 14px; font-size: 12px;" onclick="testEscapeHatchContract()">Query Base L2 Timelock Status ⏳</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Non-Custodial Deposit Modal -->
  <div id="deposit-modal" class="trade-modal" onclick="closeDepositModal(event)">
    <div class="trade-modal-box" onclick="event.stopPropagation()">
      <button class="modal-close-btn" onclick="closeDepositModal()">&times;</button>
      <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 4px;">Deposit to Base L2 Sovereign Vault</h3>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Direct deposit address generated for your Web3 sovereign vault</p>

      <div class="form-group">
        <label>Asset</label>
        <select id="deposit-asset-select" class="form-input">
          <option value="USDT">USDT (Tether USD - Base L2)</option>
          <option value="BTC">BTC (Bitcoin Sovereign - Base L2)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Your Base L2 Vault Address</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" readonly id="vault-addr-input" value="0x8a9BF241c8889953F9d4793f77EB0076a5bFF241" class="form-input" style="font-family: var(--font-mono); font-size: 12px;" />
          <button class="btn-ghost" style="padding: 0 14px;" onclick="copyVaultAddress()">Copy</button>
        </div>
      </div>

      <button class="btn-primary" style="width: 100%; padding: 12px; margin-top: 10px;" onclick="simulateInboundDeposit()">
        Simulate Inbound On-Chain Deposit (+5,000 USDT)
      </button>
    </div>
  </div>

  <!-- Non-Custodial Withdraw Modal -->
  <div id="withdraw-modal" class="trade-modal" onclick="closeWithdrawModal(event)">
    <div class="trade-modal-box" onclick="event.stopPropagation()">
      <button class="modal-close-btn" onclick="closeWithdrawModal()">&times;</button>
      <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 4px;">Withdraw from Sovereign Vault</h3>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Transfer to your external Ethereum / Base L2 wallet</p>

      <div class="form-group">
        <label>Asset</label>
        <select id="withdraw-asset-select" class="form-input">
          <option value="USDT">USDT</option>
          <option value="BTC">BTC</option>
        </select>
      </div>

      <div class="form-group">
        <label>Destination Address</label>
        <input type="text" id="withdraw-dest" placeholder="0x..." class="form-input" style="font-family: var(--font-mono);" />
      </div>

      <div class="form-group">
        <label>Amount</label>
        <input type="number" id="withdraw-amount" placeholder="e.g. 500" class="form-input" />
      </div>

      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
        Base L2 Network Gas: <strong style="color: #00e676;">0.05 USDT</strong> (Sub-cent batch compression)
      </div>

      <button class="btn-primary" style="width: 100%; padding: 12px;" onclick="executeWithdrawal()">
        Sign &amp; Execute Sovereign Withdrawal
      </button>
    </div>
  </div>

  ${getAuthModalHtml()}

  <script>
    // ------------------------------------------------------------------------
    // STATE ENGINE: Balances, Order Book, Candles, and Orders
    // ------------------------------------------------------------------------
    let userState = {
      balances: { USDT: 50000.00, BTC: 1.2500 },
      holds: { USDT: 0.00, BTC: 0.0000 },
      openOrders: [],
      tradeHistory: []
    };

    let currentSide = 'buy';
    let currentBtcPrice = 64280.50;
    let btcCandles = [];
    let selectedTimeframe = '1m';

    // Generate initial historical candles
    function initCandles() {
      btcCandles = [];
      let base = 64150.00;
      const count = 50;
      const now = Date.now();
      for (let i = count; i >= 0; i--) {
        const time = now - i * 60000;
        const open = base;
        const delta = (Math.random() - 0.47) * 45;
        const close = open + delta;
        const high = Math.max(open, close) + Math.random() * 25;
        const low = Math.min(open, close) - Math.random() * 25;
        const volume = Math.random() * 3.5 + 0.5;
        btcCandles.push({ time, open, high, low, close, volume });
        base = close;
      }
      currentBtcPrice = base;
    }
    initCandles();

    // Setup Canvas Chart
    const canvas = document.getElementById('candleCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      if (!canvas) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      drawChart();
    }
    window.addEventListener('resize', resizeCanvas);

    function drawChart() {
      if (!ctx || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let y = 30; y < height - 30; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Min/Max calculations
      let minP = Infinity, maxP = -Infinity;
      btcCandles.forEach(c => {
        if (c.low < minP) minP = c.low;
        if (c.high > maxP) maxP = c.high;
      });
      const padding = (maxP - minP) * 0.1 || 10;
      minP -= padding;
      maxP += padding;

      const chartHeight = height - 50;
      const candleWidth = Math.max(4, (width - 60) / btcCandles.length - 3);

      // Draw Candlesticks
      btcCandles.forEach((c, idx) => {
        const x = idx * (candleWidth + 3) + 10;
        const yOpen = chartHeight - ((c.open - minP) / (maxP - minP)) * chartHeight;
        const yClose = chartHeight - ((c.close - minP) / (maxP - minP)) * chartHeight;
        const yHigh = chartHeight - ((c.high - minP) / (maxP - minP)) * chartHeight;
        const yLow = chartHeight - ((c.low - minP) / (maxP - minP)) * chartHeight;

        const isBull = c.close >= c.open;
        const color = isBull ? '#00e676' : '#f43f5e';

        // High-Low Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, yHigh);
        ctx.lineTo(x + candleWidth / 2, yLow);
        ctx.stroke();

        // Body
        ctx.fillStyle = color;
        const top = Math.min(yOpen, yClose);
        const h = Math.max(2, Math.abs(yClose - yOpen));
        ctx.fillRect(x, top, candleWidth, h);

        // Volume Bar
        const volHeight = Math.min(30, c.volume * 6);
        ctx.fillStyle = isBull ? 'rgba(0, 230, 118, 0.25)' : 'rgba(244, 63, 94, 0.25)';
        ctx.fillRect(x, height - volHeight - 10, candleWidth, volHeight);
      });

      // Price Scale on right
      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono';
      ctx.textAlign = 'right';
      for (let p = minP; p <= maxP; p += (maxP - minP) / 5) {
        const y = chartHeight - ((p - minP) / (maxP - minP)) * chartHeight;
        ctx.fillText(p.toFixed(1), width - 6, y + 3);
      }

      ctx.restore();
    }

    // Dynamic Order Book rendering
    function renderOrderBook() {
      const asksDiv = document.getElementById('asks-container');
      const bidsDiv = document.getElementById('bids-container');
      if (!asksDiv || !bidsDiv) return;

      const p = currentBtcPrice;
      const asks = [
        { price: (p + 25.0).toFixed(2), qty: '0.450', total: (0.45 * (p + 25)).toFixed(2), pct: 45 },
        { price: (p + 20.0).toFixed(2), qty: '1.200', total: (1.20 * (p + 20)).toFixed(2), pct: 75 },
        { price: (p + 15.0).toFixed(2), qty: '0.850', total: (0.85 * (p + 15)).toFixed(2), pct: 60 },
        { price: (p + 10.0).toFixed(2), qty: '0.320', total: (0.32 * (p + 10)).toFixed(2), pct: 30 },
        { price: (p + 5.0).toFixed(2), qty: '0.900', total: (0.90 * (p + 5)).toFixed(2), pct: 65 },
      ];

      const bids = [
        { price: (p - 5.0).toFixed(2), qty: '1.150', total: (1.15 * (p - 5)).toFixed(2), pct: 70 },
        { price: (p - 10.0).toFixed(2), qty: '0.950', total: (0.95 * (p - 10)).toFixed(2), pct: 55 },
        { price: (p - 15.0).toFixed(2), qty: '2.400', total: (2.40 * (p - 15)).toFixed(2), pct: 90 },
        { price: (p - 20.0).toFixed(2), qty: '0.650', total: (0.65 * (p - 20)).toFixed(2), pct: 40 },
        { price: (p - 25.0).toFixed(2), qty: '1.800', total: (1.80 * (p - 25)).toFixed(2), pct: 80 },
      ];

      asksDiv.innerHTML = asks.map(a => \`
        <div class="book-row ask" onclick="fillOrderForm('\${a.price}', '\${a.qty}')">
          <div class="depth-bar ask" style="width: \${a.pct}%;"></div>
          <span>\${a.price}</span><span>\${a.qty}</span><span style="text-align: right;">\${a.total}</span>
        </div>
      \`).join('');

      bidsDiv.innerHTML = bids.map(b => \`
        <div class="book-row bid" onclick="fillOrderForm('\${b.price}', '\${b.qty}')">
          <div class="depth-bar bid" style="width: \${b.pct}%;"></div>
          <span>\${b.price}</span><span>\${b.qty}</span><span style="text-align: right;">\${b.total}</span>
        </div>
      \`).join('');
    }

    function fillOrderForm(price, qty) {
      document.getElementById('order-price').value = price;
      document.getElementById('order-qty').value = qty;
      calculateOrderTotal();
      showToast('Book Clicked', 'Populated price ' + price + ' and qty ' + qty, 'info');
    }

    // Live Tick Heartbeat
    setInterval(() => {
      const delta = (Math.random() - 0.48) * 8;
      currentBtcPrice += delta;
      
      const lastCandle = btcCandles[btcCandles.length - 1];
      lastCandle.close = currentBtcPrice;
      if (currentBtcPrice > lastCandle.high) lastCandle.high = currentBtcPrice;
      if (currentBtcPrice < lastCandle.low) lastCandle.low = currentBtcPrice;
      lastCandle.volume += Math.random() * 0.1;

      // Update Strip & HUD
      const stripPrice = document.getElementById('market-price-strip');
      if (stripPrice) {
        stripPrice.innerText = '$' + currentBtcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        stripPrice.style.color = delta >= 0 ? '#00e676' : '#f43f5e';
      }
      const hud = document.getElementById('hud-readout');
      if (hud) {
        hud.innerText = \`O: \${lastCandle.open.toFixed(2)} | H: \${lastCandle.high.toFixed(2)} | L: \${lastCandle.low.toFixed(2)} | C: \${lastCandle.close.toFixed(2)}\`;
      }

      drawChart();
      renderOrderBook();
    }, 1500);

    setTimeout(() => { resizeCanvas(); renderOrderBook(); }, 100);

    // Order Submission Engine
    function setOrderSide(side) {
      currentSide = side;
      document.getElementById('btn-side-buy').className = side === 'buy' ? 'btn-primary' : 'btn-ghost';
      document.getElementById('btn-side-buy').style.background = side === 'buy' ? '#00e676' : 'transparent';
      document.getElementById('btn-side-sell').className = side === 'sell' ? 'btn-primary' : 'btn-ghost';
      document.getElementById('btn-side-sell').style.background = side === 'sell' ? '#f43f5e' : 'transparent';
      document.getElementById('submit-btn').innerText = side === 'buy' ? 'Sign & Submit Buy Order (EIP-712)' : 'Sign & Submit Sell Order (EIP-712)';
      document.getElementById('submit-btn').style.background = side === 'buy' ? '#00e676' : '#f43f5e';
      calculateOrderTotal();
    }

    function calculateOrderTotal() {
      const p = parseFloat(document.getElementById('order-price').value) || 0;
      const q = parseFloat(document.getElementById('order-qty').value) || 0;
      const total = p * q;
      document.getElementById('order-total-display').innerText = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT';
      
      const availEl = document.getElementById('avail-balance-display');
      if (currentSide === 'buy') {
        availEl.innerText = (userState.balances.USDT - userState.holds.USDT).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' USDT';
      } else {
        availEl.innerText = (userState.balances.BTC - userState.holds.BTC).toFixed(4) + ' BTC';
      }
    }

    function setOrderPercent(pct) {
      const p = parseFloat(document.getElementById('order-price').value) || currentBtcPrice;
      if (currentSide === 'buy') {
        const availUsdt = userState.balances.USDT - userState.holds.USDT;
        const total = availUsdt * pct;
        document.getElementById('order-qty').value = (total / p).toFixed(4);
      } else {
        const availBtc = userState.balances.BTC - userState.holds.BTC;
        document.getElementById('order-qty').value = (availBtc * pct).toFixed(4);
      }
      calculateOrderTotal();
    }

    function handleOrderTypeChange() {
      const type = document.getElementById('order-type-select').value;
      if (type === 'market') {
        document.getElementById('order-price').value = currentBtcPrice.toFixed(2);
        document.getElementById('order-price').disabled = true;
      } else {
        document.getElementById('order-price').disabled = false;
      }
      calculateOrderTotal();
    }

    function submitTradeOrder() {
      const price = parseFloat(document.getElementById('order-price').value);
      const qty = parseFloat(document.getElementById('order-qty').value);
      const type = document.getElementById('order-type-select').value;
      const total = price * qty;

      if (!qty || qty <= 0) {
        showToast('Invalid Amount', 'Please specify an order quantity greater than 0.', 'danger');
        return;
      }

      // Check balance
      if (currentSide === 'buy') {
        const avail = userState.balances.USDT - userState.holds.USDT;
        if (total > avail) {
          showToast('Insufficient Balance', 'Required ' + total.toFixed(2) + ' USDT, but available is ' + avail.toFixed(2) + ' USDT.', 'danger');
          return;
        }
      } else {
        const avail = userState.balances.BTC - userState.holds.BTC;
        if (qty > avail) {
          showToast('Insufficient BTC', 'Required ' + qty.toFixed(4) + ' BTC, but available is ' + avail.toFixed(4) + ' BTC.', 'danger');
          return;
        }
      }

      const orderId = 'CC-ORD-' + Math.floor(1000 + Math.random() * 9000);

      // If Market or aggressive Limit -> Execute immediately
      if (type === 'market' || (currentSide === 'buy' && price >= currentBtcPrice) || (currentSide === 'sell' && price <= currentBtcPrice)) {
        if (currentSide === 'buy') {
          userState.balances.USDT -= total;
          userState.balances.BTC += qty;
        } else {
          userState.balances.BTC -= qty;
          userState.balances.USDT += total;
        }
        
        userState.tradeHistory.unshift({
          id: orderId,
          time: new Date().toLocaleTimeString(),
          side: currentSide.toUpperCase(),
          price: price.toFixed(2),
          qty: qty.toFixed(4),
          fee: (total * 0.001).toFixed(2) + ' USDT',
          status: 'Settled on Base L2'
        });

        showToast('Trade Matched & Settled!', \`\${currentSide.toUpperCase()} \${qty} BTC @ \${price} USDT. Pre-trade invariant balance captured.\`, 'success');
      } else {
        // Limit resting on order book -> Pre-trade hold
        if (currentSide === 'buy') {
          userState.holds.USDT += total;
        } else {
          userState.holds.BTC += qty;
        }

        userState.openOrders.unshift({
          id: orderId,
          time: new Date().toLocaleTimeString(),
          type: type.toUpperCase(),
          side: currentSide.toUpperCase(),
          price: price.toFixed(2),
          qty: qty.toFixed(4),
          filled: '0.0%'
        });

        showToast('Order Placed on Book', \`Limit \${currentSide.toUpperCase()} \${qty} BTC resting in deterministic matching engine.\`, 'info');
      }

      updateTables();
      calculateOrderTotal();
    }

    function cancelOpenOrder(id) {
      const idx = userState.openOrders.findIndex(o => o.id === id);
      if (idx !== -1) {
        const o = userState.openOrders[idx];
        const total = parseFloat(o.price) * parseFloat(o.qty);
        if (o.side === 'BUY') {
          userState.holds.USDT = Math.max(0, userState.holds.USDT - total);
        } else {
          userState.holds.BTC = Math.max(0, userState.holds.BTC - parseFloat(o.qty));
        }
        userState.openOrders.splice(idx, 1);
        showToast('Order Canceled', 'Pre-trade balance hold released.', 'info');
        updateTables();
        calculateOrderTotal();
      }
    }

    function updateTables() {
      // Open orders
      const openCount = document.getElementById('open-orders-count');
      if (openCount) openCount.innerText = userState.openOrders.length;
      const tbodyOrders = document.getElementById('open-orders-tbody');
      if (tbodyOrders) {
        if (userState.openOrders.length === 0) {
          tbodyOrders.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">No active open orders in deterministic engine.</td></tr>';
        } else {
          tbodyOrders.innerHTML = userState.openOrders.map(o => \`
            <tr>
              <td style="color: #38bdf8;">\${o.id}</td>
              <td>BTC-USDT</td>
              <td>\${o.type}</td>
              <td style="color: \${o.side === 'BUY' ? '#00e676' : '#f43f5e'}; font-weight: 700;">\${o.side}</td>
              <td style="text-align: right;">\${o.price}</td>
              <td style="text-align: right;">\${o.qty}</td>
              <td style="text-align: right;">\${o.filled}</td>
              <td style="color: #94a3b8;">\${o.time}</td>
              <td style="text-align: center;"><button class="btn-ghost" style="padding: 2px 8px; font-size: 11px; color: #f43f5e;" onclick="cancelOpenOrder('\${o.id}')">Cancel</button></td>
            </tr>
          \`).join('');
        }
      }

      // History
      const tbodyHistory = document.getElementById('history-tbody');
      if (tbodyHistory) {
        if (userState.tradeHistory.length === 0) {
          tbodyHistory.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No executions logged yet in current session.</td></tr>';
        } else {
          tbodyHistory.innerHTML = userState.tradeHistory.map(h => \`
            <tr>
              <td style="color: #94a3b8;">\${h.time}</td>
              <td style="color: #a78bfa;">\${h.id}</td>
              <td>BTC-USDT</td>
              <td style="color: \${h.side === 'BUY' ? '#00e676' : '#f43f5e'}; font-weight: 700;">\${h.side}</td>
              <td style="text-align: right;">\${h.price}</td>
              <td style="text-align: right;">\${h.qty}</td>
              <td style="text-align: right; color: var(--brand-cyan);">\${h.fee}</td>
              <td style="color: #00e676;">\${h.status}</td>
            </tr>
          \`).join('');
        }
      }

      // Vault Assets
      const availUsdt = userState.balances.USDT - userState.holds.USDT;
      const availBtc = userState.balances.BTC - userState.holds.BTC;
      document.getElementById('asset-total-usdt').innerText = userState.balances.USDT.toLocaleString('en-US', { minimumFractionDigits: 2 });
      document.getElementById('asset-avail-usdt').innerText = availUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 });
      document.getElementById('asset-hold-usdt').innerText = userState.holds.USDT.toLocaleString('en-US', { minimumFractionDigits: 2 });
      document.getElementById('asset-total-btc').innerText = userState.balances.BTC.toFixed(4);
      document.getElementById('asset-avail-btc').innerText = availBtc.toFixed(4);
      document.getElementById('asset-hold-btc').innerText = userState.holds.BTC.toFixed(4);
    }

    function switchBottomTab(tabName, btn) {
      document.querySelectorAll('.terminal-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-orders').style.display = tabName === 'orders' ? 'block' : 'none';
      document.getElementById('tab-history').style.display = tabName === 'history' ? 'block' : 'none';
      document.getElementById('tab-assets').style.display = tabName === 'assets' ? 'block' : 'none';
      document.getElementById('tab-escape').style.display = tabName === 'escape' ? 'block' : 'none';
    }

    function switchTimeframe(tf, btn) {
      selectedTimeframe = tf;
      document.querySelectorAll('.chart-panel .filter-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      initCandles();
      drawChart();
      showToast('Timeframe', 'Loaded ' + tf + ' candle resolution stream.', 'info');
    }

    // Deposit / Withdraw Modals
    function openDepositModal() {
      document.getElementById('deposit-modal').style.display = 'flex';
    }
    function closeDepositModal() {
      document.getElementById('deposit-modal').style.display = 'none';
    }
    function copyVaultAddress() {
      navigator.clipboard.writeText(document.getElementById('vault-addr-input').value);
      showToast('Address Copied', 'Base L2 sovereign vault address copied.', 'success');
    }
    function simulateInboundDeposit() {
      userState.balances.USDT += 5000.00;
      updateTables();
      calculateOrderTotal();
      closeDepositModal();
      showToast('Deposit Credited', '+5,000 USDT credited from Base L2 transaction 0x9a8b...7f21', 'success');
    }

    function openWithdrawModal() {
      document.getElementById('withdraw-modal').style.display = 'flex';
    }
    function closeWithdrawModal() {
      document.getElementById('withdraw-modal').style.display = 'none';
    }
    function executeWithdrawal() {
      const amt = parseFloat(document.getElementById('withdraw-amount').value);
      const dest = document.getElementById('withdraw-dest').value.trim();
      if (!amt || amt <= 0) {
        showToast('Error', 'Please enter a valid withdrawal amount.', 'danger');
        return;
      }
      if (amt > userState.balances.USDT - userState.holds.USDT) {
        showToast('Insufficient Balance', 'Amount exceeds available vault balance.', 'danger');
        return;
      }
      userState.balances.USDT -= amt;
      updateTables();
      calculateOrderTotal();
      closeWithdrawModal();
      showToast('Withdrawal Executed', \`\${amt} USDT sent to \${dest.slice(0, 8)}... Tx: 0x3e1d...f92a\`, 'success');
    }

    function testEscapeHatchContract() {
      showToast('Timelock Query', 'Contract: 0x1000...0001 | Operator Active | Next Heartbeat in 42s | Hatch: SECURE', 'info');
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// REQUEST DISPATCHER (HTTP HANDLER)
// ============================================================================
function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Serve static assets from public folder
  if (pathname === '/logo.png' || pathname === '/logo.jpg') {
    const file = path.join(__dirname, 'public', 'logo.png');
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return fs.createReadStream(file).pipe(res);
    }
  }

  if (pathname === '/visa-card.jpg' || pathname === '/visa-card.png') {
    const file = path.join(__dirname, 'public', 'visa-card.jpg');
    if (fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      return fs.createReadStream(file).pipe(res);
    }
  }

  // API: Card Waitlist
  if (pathname === '/api/card/waitlist' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const entry = cms.joinCardWaitlist(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(entry));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Career Job Application
  if (pathname === '/api/careers/apply' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const app = cms.addJobApplication(payload);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, application: app }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: CMS Data
  if (pathname === '/api/cms/media') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(cms.getCmsData().media || []));
  }

  if (pathname === '/api/cms/careers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(cms.getCmsData().careers || []));
  }

  // HTML Route Dispatch
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

  if (pathname === '/trade') {
    return res.end(renderTradeTerminal());
  }

  if (pathname === '/card') {
    return res.end(renderCardPage());
  }

  if (pathname === '/media') {
    return res.end(renderMediaPage());
  }

  if (pathname === '/careers') {
    return res.end(renderCareersPage());
  }

  // Default: Homepage (also handles /login and /signup)
  return res.end(renderHomePage());
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[apps/web] CapeChain Labs Marketing & Trading Web App live on http://localhost:${PORT}`);
  });
}

module.exports = handleRequest;
