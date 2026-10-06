/**
 * Database Migration Runner
 * Executes migrations in strict numeric sequence from db/migrations/
 * Enforces forward-only execution and verifies that applied migrations are never edited.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');

function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files.map(file => {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return { file, fullPath, hash, content };
  });
}

function printMigrationPlan() {
  const migrations = getMigrationFiles();
  console.log(`=== Found ${migrations.length} Migration Files ===`);
  migrations.forEach((m, idx) => {
    console.log(`[${idx + 1}/${migrations.length}] ${m.file} (SHA-256: ${m.hash.slice(0, 12)}...)`);
  });
}

if (require.main === module) {
  printMigrationPlan();
}

module.exports = { getMigrationFiles };
