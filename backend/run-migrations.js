#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * JASB Database Migration Runner
 * Runs SQL migration files using Node.js and pg library
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigrations() {
  const { DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    log('❌ DATABASE_URL not found in environment variables', 'red');
    process.exit(1);
  }

  log('🚀 Starting JASB Database Migrations...', 'blue');

  const maskedDatabaseHost = (() => {
    const urlParts = DATABASE_URL.split('@');
    if (urlParts.length < 2) return 'hidden';
    const hostPart = urlParts[1].split('/')[0];
    return hostPart || 'hidden';
  })();

  log(`📦 Database: ${maskedDatabaseHost}`, 'blue');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Connect to database
    log('\n🔌 Connecting to database...', 'blue');
    await client.connect();
    log('✅ Connected successfully', 'green');

    // Check if tables already exist
    const checkResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'users'
    `);

    if (parseInt(checkResult.rows[0].count, 10) > 0) {
      log('\n⚠️  Warning: Database tables already exist!', 'yellow');
      log('This will skip migration to avoid errors.', 'yellow');
      log(
        'If you want to reset the database, please do it manually via Supabase dashboard.',
        'yellow',
      );
      await client.end();
      return;
    }

    // Run 001_core.sql
    log('\n📝 Running 001_core.sql (Core Tables)...', 'blue');
    const coreSql = fs.readFileSync(
      path.join(__dirname, '../sql/001_core.sql'),
      'utf8',
    );
    await client.query(coreSql);
    log('✅ Core tables created', 'green');

    // Check if Supabase auth schema exists
    const authCheck = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'auth'
    `);

    // Run appropriate policies file
    if (authCheck.rows.length > 0) {
      log('\n📝 Running 002_policies.sql (Supabase RLS)...', 'blue');
      const policiesSql = fs.readFileSync(
        path.join(__dirname, '../sql/002_policies.sql'),
        'utf8',
      );
      await client.query(policiesSql);
      log('✅ Supabase RLS policies created', 'green');
    } else {
      log('\n📝 Running 002_policies_standalone.sql (Standard RLS)...', 'blue');
      const policiesSql = fs.readFileSync(
        path.join(__dirname, '../sql/002_policies_standalone.sql'),
        'utf8',
      );
      await client.query(policiesSql);
      log('✅ Standard RLS policies created', 'green');
    }

    // Run 003_add_split_columns.sql if exists
    const splitColumnsPath = path.join(
      __dirname,
      '../sql/003_add_split_columns.sql',
    );
    if (fs.existsSync(splitColumnsPath)) {
      log('\n📝 Running 003_add_split_columns.sql...', 'blue');
      const splitSql = fs.readFileSync(splitColumnsPath, 'utf8');
      await client.query(splitSql);
      log('✅ Split columns migration applied', 'green');
    }

    // Insert test data (optional)
    log('\n📝 Inserting test data...', 'blue');
    const testDataSql = fs.readFileSync(
      path.join(__dirname, '../sql/test_data.sql'),
      'utf8',
    );
    await client.query(testDataSql);
    log('✅ Test data inserted', 'green');

    // Verify tables
    log('\n🔍 Verifying tables...', 'blue');
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    log(`✅ Found ${tables.rows.length} tables:`, 'green');
    tables.rows.forEach((row) => {
      log(`  - ${row.table_name}`, 'green');
    });

    // Show record counts
    log('\n📊 Record counts:', 'blue');
    const counts = await client.query(`
      SELECT 'users' as table_name, COUNT(*) as count FROM users
      UNION ALL
      SELECT 'groups', COUNT(*) FROM groups
      UNION ALL
      SELECT 'expenses', COUNT(*) FROM expenses
      UNION ALL
      SELECT 'expense_splits', COUNT(*) FROM expense_splits
    `);

    counts.rows.forEach((row) => {
      log(`  - ${row.table_name}: ${row.count}`, 'green');
    });

    log('\n🎉 Database migration completed successfully!', 'green');
  } catch (error) {
    log('\n❌ Migration failed!', 'red');
    log(`Error: ${error.message}`, 'red');
    if (error.stack) {
      log('\nStack trace:', 'red');
      log(error.stack, 'red');
    }
    process.exit(1);
  } finally {
    await client.end();
    log('\n🔌 Database connection closed', 'blue');
  }
}

// Run migrations
runMigrations().catch((error) => {
  log(`Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
