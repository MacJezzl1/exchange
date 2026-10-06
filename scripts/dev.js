#!/usr/bin/env node
/**
 * Local development runner for the Hybrid Exchange Platform
 * Orchestrates local dev environment, checks prerequisites, and boots services.
 */
const { spawn } = require('child_process');
const path = require('path');

console.log('=== Hybrid Exchange Platform Local Development Runner ===');
console.log('Environment: Phase 1 (Core Backbone Active)');

// 1. Launch Admin API on port 8081
const adminApiProcess = spawn('node', ['services/admin-api/dist/index.js'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});

// 2. Launch Admin Portal Shell on port 3001
const adminAppProcess = spawn('node', ['apps/admin/server.js'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});

console.log('--------------------------------------------------');
console.log('🚀 Admin Control Plane: http://localhost:3001');
console.log('🔒 Isolated Admin API:  http://localhost:8081');
console.log('--------------------------------------------------');

process.on('SIGINT', () => {
  adminApiProcess.kill();
  adminAppProcess.kill();
  process.exit(0);
});
