#!/usr/bin/env node
/**
 * Turnkey Supabase Migration Runner for Hybrid Exchange Platform
 * 
 * Usage:
 *   node scripts/supabase-migrate.js
 * 
 * Environment Variables:
 *   DATABASE_URL or SUPABASE_DB_URL (e.g. postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres)
 */

const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261006000001_initial_schema.sql');
const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');

console.log('================================================================');
console.log('       Hybrid Exchange Platform — Supabase Migration Utility    ');
console.log('================================================================');

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration file not found at: ${migrationPath}`);
  process.exit(1);
}

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const seedSql = fs.existsSync(seedPath) ? fs.readFileSync(seedPath, 'utf8') : '';

console.log(`📄 Migration file loaded: ${migrationPath} (${(migrationSql.length / 1024).toFixed(1)} KB)`);
if (seedSql) {
  console.log(`🌱 Seed data loaded:      ${seedPath} (${(seedSql.length / 1024).toFixed(1)} KB)`);
}

if (!dbUrl) {
  console.log('\n⚠️  No DATABASE_URL or SUPABASE_DB_URL found in environment.');
  console.log('\nTo deploy to Supabase:');
  console.log('----------------------------------------------------------------');
  console.log('Option 1: Paste directly into the Supabase Dashboard SQL Editor');
  console.log(`  1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/sql`);
  console.log(`  2. Copy and paste the contents of: supabase/migrations/20261006000001_initial_schema.sql`);
  console.log(`  3. Click "Run" to establish all 12 isolated schemas, triggers, and tables.`);
  console.log('\nOption 2: Run via CLI or environment variable:');
  console.log('  $env:DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"');
  console.log('  node scripts/supabase-migrate.js');
  console.log('----------------------------------------------------------------\n');
  process.exit(0);
}

// When DATABASE_URL is set, connect and execute
async function runMigration() {
  let pg;
  try {
    pg = require('pg');
  } catch (_) {
    console.log('Installing pg client for automated connection...');
    require('child_process').execSync('pnpm add -w pg @types/pg', { stdio: 'inherit' });
    pg = require('pg');
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('\nConnecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('Executing initial schema migration...');
    await client.query(migrationSql);
    console.log('✅ All 12 schemas, tables, triggers, and publications applied!');

    if (seedSql) {
      console.log('Executing development seeds...');
      await client.query(seedSql);
      console.log('✅ Development assets and pairs seeded!');
    }

    console.log('\n🎉 Supabase database migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
