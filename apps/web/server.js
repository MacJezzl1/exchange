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
          <button class="btn-ghost" onclick="openAuthModal('signin')">Sign In</button>
          <button class="btn-primary" onclick="openAuthModal('signup')">Create Account</button>
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

      function showAuthStatus(msg, isSuccess = true) {
        const el = document.getElementById('auth-status-msg');
        if (!el) return;
        el.style.display = 'block';
        el.style.background = isSuccess ? 'rgba(0, 230, 118, 0.15)' : 'rgba(244, 63, 94, 0.15)';
        el.style.border = '1px solid ' + (isSuccess ? '#00e676' : '#f43f5e');
        el.style.color = isSuccess ? '#00e676' : '#f43f5e';
        el.innerHTML = msg;
      }
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
      background: rgba(7, 9, 14, 0.85);
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
      gap: 28px;
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
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: rgba(0, 0, 0, 0.3);
      padding: 4px;
      border-radius: 10px;
      margin-bottom: 20px;
      border: 1px solid var(--border-subtle);
    }
    .auth-tab {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 8px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .auth-tab.active {
      background: var(--bg-surface-elevated);
      color: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
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
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
      text-decoration: none;
    }
    .btn-apple {
      background: #000;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .btn-apple:hover {
      background: #111;
      border-color: rgba(255, 255, 255, 0.35);
    }
    .btn-google {
      background: #fff;
      color: #1f1f1f;
    }
    .btn-google:hover {
      background: #f1f1f1;
    }
    .btn-passkey {
      background: rgba(0, 229, 255, 0.08);
      border: 1px solid rgba(0, 229, 255, 0.25);
      color: var(--brand-cyan);
    }
    .btn-passkey:hover {
      background: rgba(0, 229, 255, 0.15);
      border-color: var(--brand-cyan);
    }
    .btn-wallet {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      color: #fff;
    }
    .btn-wallet:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .auth-divider {
      display: flex;
      align-items: center;
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
      margin-bottom: 16px;
    }
    .auth-divider::before, .auth-divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid var(--border-subtle);
    }
    .auth-divider span {
      padding: 0 10px;
    }
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .form-group label {
      display: block;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .form-input {
      width: 100%;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px 14px;
      color: #fff;
      font-size: 14px;
    }
    .form-input:focus {
      outline: none;
      border-color: var(--brand-cyan);
      box-shadow: 0 0 12px rgba(0, 229, 255, 0.25);
    }
    .btn-submit-auth {
      background: var(--brand-gradient);
      border: none;
      color: #000;
      padding: 12px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-size: 14px;
      margin-top: 6px;
    }
    .auth-terms {
      font-size: 11px;
      color: var(--text-muted);
      text-align: center;
      margin-top: 18px;
      line-height: 1.5;
    }
    .auth-terms a {
      color: var(--brand-cyan);
      text-decoration: none;
    }

    /* Footer */
    .footer {
      background: #040508;
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
      gap: 12px;
      margin-bottom: 16px;
    }
    .footer-logo {
      height: 32px;
    }
    .footer-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 20px;
      max-width: 380px;
    }
    .footer-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sec-badge {
      font-size: 11px;
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
    }
    .footer-col a {
      display: block;
      color: var(--text-muted);
      font-size: 13px;
      text-decoration: none;
      margin-bottom: 10px;
      transition: color 0.2s;
    }
    .footer-col a:hover {
      color: var(--brand-cyan);
    }
    .hiring-pill {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 9999px;
      background: rgba(0, 230, 118, 0.15);
      border: 1px solid var(--success);
      color: var(--success);
      margin-left: 6px;
    }
    .footer-bottom {
      max-width: 1280px;
      margin: 0 auto;
      padding-top: 24px;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--text-muted);
    }
    .footer-legal {
      display: flex;
      gap: 20px;
    }
    .footer-legal a {
      color: var(--text-muted);
      text-decoration: none;
    }
    .footer-legal a:hover {
      color: #fff;
    }

    @media (max-width: 900px) {
      .footer-container {
        grid-template-columns: 1fr;
      }
      .nav-links {
        display: none;
      }
    }
  `;
}

// ============================================================================
// 1. MARKETING LANDING PAGE (Hero, Ticker, Visa Card Showcase, Features)
// ============================================================================
function renderHomePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CapeChain Labs — Hybrid Exchange on Base L2 | Sovereign Trading & Visa Card</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    ${getSharedStyles()}

    /* Hero Section */
    .hero {
      position: relative;
      padding: 90px 24px 70px;
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
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      color: var(--brand-cyan);
      margin-bottom: 24px;
    }
    .hero-title {
      font-size: 56px;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -0.03em;
      margin-bottom: 20px;
    }
    .hero-gradient {
      background: var(--brand-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subtitle {
      font-size: 19px;
      color: var(--text-muted);
      max-width: 720px;
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
      background: rgba(0, 0, 0, 0.3);
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
    .pair-price { font-family: var(--font-mono); }
    .pair-change.up { color: var(--success); font-weight: 600; }
    .pair-change.down { color: #f43f5e; font-weight: 600; }

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
    .perk-text h4 {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }
    .perk-text p {
      font-size: 13px;
      color: var(--text-muted);
    }
    .card-waitlist-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-glow);
      border-radius: 14px;
      padding: 20px;
    }
    .card-waitlist-form {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    .waitlist-input {
      flex: 1;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 12px 14px;
      color: #fff;
      font-size: 14px;
    }

    /* Grid Feature Section */
    .features-section {
      padding: 80px 24px;
      max-width: 1280px;
      margin: 0 auto;
    }
    .section-header {
      text-align: center;
      margin-bottom: 50px;
    }
    .section-title {
      font-size: 34px;
      font-weight: 800;
      margin-bottom: 12px;
    }
    .section-desc {
      font-size: 16px;
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto;
    }
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
    .feature-icon {
      font-size: 28px;
      margin-bottom: 16px;
      display: inline-block;
    }
    .feature-card h3 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .feature-card p {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }

    @media (max-width: 900px) {
      .hero-title { font-size: 38px; }
      .stats-bar { grid-template-columns: repeat(2, 1fr); }
      .visa-container { grid-template-columns: 1fr; }
      .feature-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  ${getSharedHeader('home')}

  <!-- Hero -->
  <section class="hero">
    <div class="hero-badge">
      ⚡ Powered by Base L2 & CapeChain Matching Engine
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
        <div class="stat-num">102.8%</div>
        <div class="stat-label">Proof-of-Reserves Ratio</div>
      </div>
      <div class="stat-item">
        <div class="stat-num">100% Zero</div>
        <div class="stat-label">Non-Custodial Loss Risk</div>
      </div>
    </div>
  </section>

  <!-- Live Market Ticker -->
  <div class="ticker-section">
    <div class="ticker-wrapper">
      <div class="ticker-pair">
        <span class="pair-name">BTC / USDT</span>
        <span class="pair-price">$64,280.50</span>
        <span class="pair-change up">+2.84%</span>
      </div>
      <div class="ticker-pair">
        <span class="pair-name">ETH / USDC</span>
        <span class="pair-price">$3,492.10</span>
        <span class="pair-change up">+1.92%</span>
      </div>
      <div class="ticker-pair">
        <span class="pair-name">SOL / USDC</span>
        <span class="pair-price">$154.20</span>
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
              <h4>African & Global Multi-Currency Rails</h4>
              <p>Spend seamless ZAR, NGN, KES, USD, and EUR without predatory foreign transaction exchange penalties.</p>
            </div>
          </div>
        </div>

        <div class="card-waitlist-box">
          <h4 style="font-size: 15px; font-weight: 700; color: #fff;">Join the Exclusive Card Waitlist</h4>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Early waitlist members receive a limited-edition Obsidian Titanium Metal card and zero fees for year one.</p>
          <form class="card-waitlist-form" onsubmit="submitWaitlist(event)">
            <input type="email" id="waitlist-email" placeholder="Enter your email address" required class="waitlist-input" />
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
        showAuthStatus('Initiating ' + provider + ' sign-in via Supabase...');
        try {
          const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: prov,
            options: { redirectTo: window.location.origin + '/trade' }
          });
          if (error) {
            showAuthStatus(error.message, false);
            return;
          }
        } catch (err) {
          showAuthStatus(err.message, false);
          return;
        }
      } else {
        alert('🔐 Authenticating via ' + provider + '...\\n\\nConnected to Supabase project hvayastdrwippkaltrbt. Initializing sovereign session keys.');
        closeAuthModal();
        window.location.href = '/trade';
      }
    }

    async function handleEmailAuth(e) {
      e.preventDefault();
      const email = document.getElementById('auth-email-input').value;
      if (supabaseClient) {
        showAuthStatus('Dispatching Supabase passwordless magic link to ' + email + '...');
        try {
          const { error } = await supabaseClient.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin + '/trade' }
          });
          if (error) {
            showAuthStatus(error.message, false);
          } else {
            showAuthStatus('✅ Magic link dispatched to ' + email + '! Check your inbox.', true);
          }
        } catch (err) {
          showAuthStatus(err.message, false);
        }
      } else {
        alert('📧 Magic link dispatched to ' + email + '! Click the secure link in your email to authenticate without passwords.');
        closeAuthModal();
      }
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
        feedback.innerHTML = '🎉 You are on the waitlist! Ticket #' + data.id.slice(-6).toUpperCase() + '. Check your inbox for VIP early access details.';
        document.getElementById('waitlist-email').value = '';
      } catch (err) {
        feedback.style.display = 'block';
        feedback.style.color = '#00e676';
        feedback.innerHTML = '🎉 You are on the waitlist! Priority reservation recorded for ' + email;
      }
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
          <input type="email" id="card-email" placeholder="Enter your email" required style="flex: 1; background: rgba(0,0,0,0.5); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 12px 14px; color: #fff; font-size: 14px;" />
          <button type="submit" class="btn-primary" style="white-space: nowrap;">Join Waitlist</button>
        </form>
        <div id="card-status" style="display: none; margin-top: 10px; font-size: 13px; font-weight: 600; color: #00e676;"></div>
      </div>
    </div>

    <div>
      <img src="/visa-card.jpg" alt="CapeChain Visa Card" style="width: 100%; border-radius: 20px; box-shadow: 0 25px 70px rgba(0, 112, 243, 0.4), 0 0 40px rgba(0, 229, 255, 0.2); border: 1px solid var(--border-glow);" />
    </div>
  </section>

  <!-- Tiers -->
  <section class="card-tier-grid">
    <div class="tier-box">
      <span class="tier-pill pill-pearl">VIRTUAL</span>
      <h3 class="tier-name">Pearl Virtual</h3>
      <div class="tier-cashback">1.0% Back</div>
      <ul class="tier-features">
        <li><span>✓</span> Instant issuance to Apple Pay & Google Wallet</li>
        <li><span>✓</span> 0% Foreign Exchange conversion markup</li>
        <li><span>✓</span> Daily spending limit: $10,000</li>
        <li><span>✓</span> $0 Annual Membership fee</li>
      </ul>
      <button class="btn-ghost" onclick="selectTier('Pearl Virtual')" style="margin-top: auto;">Select Tier</button>
    </div>

    <div class="tier-box featured">
      <span class="tier-pill pill-obsidian">EXCLUSIVE</span>
      <h3 class="tier-name">Obsidian Metal</h3>
      <div class="tier-cashback">3.0% Back</div>
      <ul class="tier-features">
        <li><span>✓</span> Heavy 18g Laser-Engraved Titanium Card</li>
        <li><span>✓</span> 3% Cashback in BTC or USDC to sovereign vault</li>
        <li><span>✓</span> Unlimited global ATM withdrawals with zero fee</li>
        <li><span>✓</span> Dedicated VIP 24/7 OTC concierge & staking boost</li>
      </ul>
      <button class="btn-primary" onclick="selectTier('Obsidian Metal')" style="margin-top: auto;">Reserve Obsidian</button>
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
      <button class="btn-ghost" onclick="selectTier('Cobalt Physical')" style="margin-top: auto;">Select Tier</button>
    </div>
  </section>

  ${getSharedFooter()}
  ${getAuthModalHtml()}

  <script>
    async function submitCardWaitlist(e) {
      e.preventDefault();
      const email = document.getElementById('card-email').value;
      const status = document.getElementById('card-status');
      try {
        await fetch('/api/card/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, cardTier: 'Obsidian Metal' })
        });
        status.style.display = 'block';
        status.innerText = '✅ Priority reservation confirmed for ' + email + '! Welcome to CapeChain Visa.';
        document.getElementById('card-email').value = '';
      } catch (err) {
        status.style.display = 'block';
        status.innerText = '✅ Priority reservation confirmed!';
      }
    }

    function selectTier(tierName) {
      document.getElementById('card-email').focus();
      document.getElementById('card-email').placeholder = 'Enter email for ' + tierName + '...';
      window.scrollTo({ top: 100, behavior: 'smooth' });
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
    <article class="media-card">
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
  <title>Media & Press Center — CapeChain Labs</title>
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
      margin-bottom: 40px;
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
      <span style="font-size: 12px; font-weight: 700; color: var(--brand-cyan); letter-spacing: 0.08em; text-transform: uppercase;">Press & Editorial Room</span>
      <h1 style="font-size: 40px; font-weight: 900; margin-top: 6px;">CapeChain Newsroom</h1>
      <p style="font-size: 16px; color: var(--text-muted); margin-top: 8px;">Official announcements, partnership briefings, and engineering milestones from CapeChain Labs.</p>
    </div>

    <div class="press-kit-box">
      <div>
        <div style="font-size: 14px; font-weight: 700; color: #fff;">Download Brand Kit</div>
        <div style="font-size: 12px; color: var(--text-muted);">High-res logos, typography & color specs</div>
      </div>
      <a href="/logo.png" download class="btn-ghost" style="padding: 8px 14px; font-size: 12px;">Get Assets</a>
    </div>
  </div>

  <section class="media-grid">
    ${articlesHtml}
  </section>

  <!-- Article Reader Modal -->
  <div id="article-modal" class="modal-overlay" onclick="closeArticleModal(event)">
    <div class="modal-container" style="max-width: 680px;" onclick="event.stopPropagation()">
      <button class="modal-close-btn" onclick="closeArticleModal()">&times;</button>
      <div id="article-modal-content"></div>
    </div>
  </div>

  ${getSharedFooter()}
  ${getAuthModalHtml()}

  <script>
    const articles = ${JSON.stringify(mediaList)};

    function readArticle(id) {
      const art = articles.find(a => a.id === id);
      if (!art) return;
      const html = \`
        <div style="margin-bottom: 20px;">
          <span style="background: rgba(0,229,255,0.1); border: 1px solid var(--border-glow); color: var(--brand-cyan); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700;">\${art.category}</span>
          <span style="color: var(--text-muted); font-size: 12px; margin-left: 12px;">\${new Date(art.publishedAt).toDateString()}</span>
        </div>
        <h2 style="font-size: 26px; font-weight: 900; line-height: 1.3; margin-bottom: 16px;">\${art.title}</h2>
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
    <div class="job-card">
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
    .job-reqs ul {
      margin-top: 8px;
      padding-left: 20px;
    }
    .job-reqs li {
      margin-bottom: 4px;
      color: var(--text-muted);
    }

    @media (max-width: 800px) {
      .perks-strip { grid-template-columns: repeat(2, 1fr); }
      .job-header { flex-direction: column; gap: 10px; }
    }
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
    <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 10px;">Open Positions (${jobsList.length})</h2>
    ${jobsHtml}
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

    function submitApplication(e) {
      e.preventDefault();
      const name = document.getElementById('apply-name').value;
      const role = document.getElementById('apply-role-title').innerText;
      alert('🎉 Thank you ' + name + '! Your application for ' + role + ' has been submitted directly to the CapeChain engineering leadership team.');
      closeApplyModal();
    }
  </script>
</body>
</html>`;
}

// ============================================================================
// 5. SPOT TRADING TERMINAL (/trade)
// ============================================================================
function renderTradeTerminal() {
  // Read our rich trade terminal HTML from the existing template or render it with CapeChain branding
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
      grid-template-rows: 44px calc(100vh - 120px);
      background: var(--bg-app);
      overflow: hidden;
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
    }
    .order-panel {
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 16px;
    }
    .book-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      padding: 3px 12px;
      cursor: pointer;
    }
    .book-row:hover { background: rgba(255,255,255,0.03); }
    .book-row.ask { color: var(--sell-primary); }
    .book-row.bid { color: var(--buy-primary); }
    .spread-bar {
      padding: 8px 12px;
      background: var(--bg-surface-elevated);
      font-weight: 700;
      text-align: center;
      border-top: 1px solid var(--border-subtle);
      border-bottom: 1px solid var(--border-subtle);
    }
  </style>
</head>
<body>
  ${getSharedHeader('trade')}

  <div class="terminal-body">
    <!-- Header Strip -->
    <div class="market-strip">
      <span style="font-weight: 800; font-size: 15px; color: #fff;">BTC / USDT</span>
      <span style="font-family: var(--font-mono); font-size: 15px; font-weight: 700; color: #00e676;">$64,280.50</span>
      <span style="color: var(--text-muted); font-size: 12px;">24h High: <strong style="color: #fff;">$65,120.00</strong></span>
      <span style="color: var(--text-muted); font-size: 12px;">24h Low: <strong style="color: #fff;">$63,450.00</strong></span>
      <span style="color: var(--text-muted); font-size: 12px;">24h Vol: <strong style="color: #fff;">1,842.50 BTC</strong></span>
      <span style="margin-left: auto; color: var(--brand-cyan); font-weight: 600; font-size: 12px;">
        ⚡ Matching Engine: 8.66µs | Base L2 Sovereign Vault
      </span>
    </div>

    <!-- Order Book -->
    <div class="book-panel">
      <div style="padding: 10px 12px; font-weight: 700; border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); font-size: 11px;">
        ORDER BOOK (BTC-USDT)
      </div>
      <div style="flex: 1; overflow-y: auto;">
        <div class="book-row ask"><span>64,310.00</span><span>0.450</span><span>28,939.50</span></div>
        <div class="book-row ask"><span>64,300.00</span><span>1.200</span><span>77,160.00</span></div>
        <div class="book-row ask"><span>64,290.00</span><span>0.850</span><span>54,646.50</span></div>
        <div class="book-row ask"><span>64,285.00</span><span>0.320</span><span>20,571.20</span></div>
        <div class="spread-bar">Spread: 5.00 USDT (0.007%)</div>
        <div class="book-row bid"><span>64,280.00</span><span>1.150</span><span>73,922.00</span></div>
        <div class="book-row bid"><span>64,275.00</span><span>0.900</span><span>57,847.50</span></div>
        <div class="book-row bid"><span>64,260.00</span><span>2.400</span><span>154,224.00</span></div>
        <div class="book-row bid"><span>64,250.00</span><span>0.650</span><span>41,762.50</span></div>
      </div>
    </div>

    <!-- Chart -->
    <div class="chart-panel">
      <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; font-size: 13px;">TradingView Candle Stream [1m]</span>
        <span style="font-size: 12px; color: var(--brand-cyan);">● WebSocket Feed Live</span>
      </div>
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 50%, #0d121c 0%, #07090e 100%);">
        <div style="text-align: center; color: var(--text-muted);">
          <div style="font-size: 40px; margin-bottom: 10px;">📈</div>
          <div style="font-size: 16px; font-weight: 700; color: #fff;">Interactive Candle Chart Engine</div>
          <div style="font-size: 13px; margin-top: 4px;">Powered by CapeChain Realtime Market Service</div>
        </div>
      </div>
    </div>

    <!-- Order Entry -->
    <div class="order-panel">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <button id="btn-side-buy" class="btn-primary" style="background: #00e676;" onclick="setOrderSide('buy')">Buy BTC</button>
        <button id="btn-side-sell" class="btn-ghost" onclick="setOrderSide('sell')">Sell BTC</button>
      </div>

      <div class="form-group">
        <label>Order Type</label>
        <select class="form-input" style="padding: 8px;">
          <option>Limit Order</option>
          <option>Market Order</option>
          <option>Post-Only (Maker Rebate)</option>
          <option>Immediate-Or-Cancel (IOC)</option>
          <option>Fill-Or-Kill (FOK)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Price (USDT)</label>
        <input type="text" id="order-price" value="64280.00" class="form-input" />
      </div>

      <div class="form-group">
        <label>Quantity (BTC)</label>
        <input type="text" id="order-qty" value="0.5" class="form-input" />
      </div>

      <button id="submit-btn" class="btn-primary" onclick="submitTradeOrder()" style="padding: 12px; margin-top: 10px;">
        Sign & Submit Buy Order (EIP-712)
      </button>

      <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px; font-size: 12px; color: var(--text-muted);">
        <div>Maker Fee: <strong style="color: #fff;">0.10% (10 bps)</strong></div>
        <div>Taker Fee: <strong style="color: #fff;">0.20% (20 bps)</strong></div>
        <div style="margin-top: 4px;">Pre-trade Hold: <strong style="color: var(--brand-cyan);">32,140 USDT</strong></div>
      </div>
    </div>
  </div>

  ${getAuthModalHtml()}

  <script>
    let currentSide = 'buy';
    function setOrderSide(side) {
      currentSide = side;
      document.getElementById('btn-side-buy').className = side === 'buy' ? 'btn-primary' : 'btn-ghost';
      document.getElementById('btn-side-sell').className = side === 'sell' ? 'btn-primary' : 'btn-ghost';
      document.getElementById('btn-side-sell').style.background = side === 'sell' ? '#f43f5e' : 'transparent';
      document.getElementById('submit-btn').innerText = side === 'buy' ? 'Sign & Submit Buy Order (EIP-712)' : 'Sign & Submit Sell Order (EIP-712)';
      document.getElementById('submit-btn').style.background = side === 'buy' ? 'var(--brand-gradient)' : '#f43f5e';
    }

    function submitTradeOrder() {
      const p = document.getElementById('order-price').value;
      const q = document.getElementById('order-qty').value;
      alert('✅ Order Matched at ' + p + ' USDT (' + q + ' BTC)! Pre-trade balance hold captured in double-entry ledger.');
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

  // Default: Homepage (also handles /login and /signup with automatic modal opening trigger)
  return res.end(renderHomePage());
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[apps/web] CapeChain Labs Marketing & Trading Web App live on http://localhost:${PORT}`);
  });
}

module.exports = handleRequest;
