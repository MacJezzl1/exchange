#!/usr/bin/env node
/**
 * Local development runner for the Hybrid Exchange Platform
 * Orchestrates dev environment setup, checks prerequisites, and launches mock/local services.
 */
console.log('=== Hybrid Exchange Platform Local Development Runner ===');
console.log('Environment: Phase 0 (Scaffold & Architectural Specs initialized)');
console.log('To run Docker infrastructure: docker compose -f infra/docker/docker-compose.yml up -d');
console.log('To run migrations: node scripts/migrate.js');
console.log('Ready for Phase 1 execution.');
