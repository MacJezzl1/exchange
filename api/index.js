/**
 * Vercel Serverless Entrypoint for Hybrid Exchange Platform
 * Dispatches incoming requests across Trader Terminal, Admin Portal, and Transparency Center.
 */
const webHandler = require('../apps/web/server');
const adminHandler = require('../apps/admin/server');
const statusHandler = require('../apps/status/server');

module.exports = function handler(req, res) {
  const url = req.url || '/';

  // 1. Transparency & Proof-of-Reserves Center & Public APIs
  if (
    url === '/status' ||
    url.startsWith('/status/') ||
    url === '/por' ||
    url.startsWith('/api/status') ||
    url.startsWith('/api/por') ||
    url.startsWith('/api/batches')
  ) {
    return statusHandler(req, res);
  }

  // 2. Admin Control Plane
  if (url === '/admin' || url.startsWith('/admin/') || url.startsWith('/api/admin')) {
    return adminHandler(req, res);
  }

  // 3. Trader Terminal (Default root)
  return webHandler(req, res);
};
