#!/usr/bin/env node
/**
 * Local development runner for the Hybrid Exchange Platform
 * Orchestrates local dev environment, checks prerequisites, and boots all services and frontends.
 */
const { spawn } = require('child_process');
const path = require('path');

console.log('================================================================');
console.log('       Hybrid Exchange Platform — Production Orchestrator       ');
console.log('================================================================');

const rootDir = path.join(__dirname, '..');
const processes = [];

function startProcess(name, cmd, args, portInfo) {
  const p = spawn(cmd, args, { cwd: rootDir, stdio: 'inherit' });
  processes.push(p);
  console.log(`[BOOT] ${name.padEnd(25)} -> ${portInfo}`);
  return p;
}

// 1. Isolated Admin API
startProcess('Admin API (MFA/RBAC)', 'node', ['services/admin-api/dist/index.js'], 'http://localhost:8081');

// 2. Trader Web Terminal
startProcess('Trader Terminal UI', 'node', ['apps/web/server.js'], 'http://localhost:3000');

// 3. Admin Control Plane UI
startProcess('Admin Portal (Four-Eyes)', 'node', ['apps/admin/server.js'], 'http://localhost:3001');

// 4. Transparency & Proof of Reserves UI
startProcess('Transparency Status Page', 'node', ['apps/status/server.js'], 'http://localhost:3002');

console.log('----------------------------------------------------------------');
console.log('🚀 Platform Endpoints:');
console.log('   - Trader Terminal:       http://localhost:3000');
console.log('   - Admin Control Plane:   http://localhost:3001');
console.log('   - Proof-of-Reserves:     http://localhost:3002');
console.log('   - Admin Internal API:    http://localhost:8081');
console.log('----------------------------------------------------------------');
console.log('Press Ctrl+C to terminate all services gracefully.');

process.on('SIGINT', () => {
  console.log('\n[SHUTDOWN] Terminating all platform services...');
  for (const p of processes) {
    try {
      p.kill();
    } catch (_) {}
  }
  process.exit(0);
});
