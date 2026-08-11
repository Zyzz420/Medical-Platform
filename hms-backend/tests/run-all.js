#!/usr/bin/env node
'use strict';

/**
 * Test runner for new edge-case coverage (complements test-integration.js).
 *
 * Runs on port 3002 so it can coexist with test-integration.js (port 3001).
 *
 * Usage:  node tests/run-all.js
 *
 * Suites:
 *   [AUTH]       Registration validation & access control
 *   [DISCHARGE]  Validation & side effects (bed freed, duplicate → 409)
 *   [DISPENSING] Stock reconciliation on update & delete
 *   [INPATIENT]  Atomic bed transfer & input validation
 *   [FHIR]       Read API — auth & resource mapping
 */

require('dotenv').config();

const { Pool } = require('pg');
const BASE = 'http://localhost:3002';
const { getStats } = require('./helpers');

const testAuth       = require('./auth.test');
const testDischarge  = require('./discharge.test');
const testDispensing = require('./dispensing.test');
const testInpatient  = require('./inpatient.test');
const testFhir       = require('./fhir.test');

// ── start the server ────────────────────────────────────────────────────────

function startServer() {
  return new Promise((resolve) => {
    process.env.PORT = '3002';
    require('../server');
    setTimeout(resolve, 1000);
  });
}

// ── resolve admin user_id from DB (works on any environment) ────────────────

async function resolveAdminUserId() {
  const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM users WHERE role = 'admin' AND is_active = TRUE LIMIT 1`
    );
    if (!rows.length) throw new Error('No active admin user found in DB. Run seed-admin first.');
    return rows[0].user_id;
  } finally {
    await pool.end();
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(55));
  console.log(' HMS Edge-Case Test Suite');
  console.log('═'.repeat(55));

  await startServer();

  const adminUserId = await resolveAdminUserId();
  console.log(`\nUsing admin user_id=${adminUserId} for token minting`);

  try {
    await testAuth(BASE, adminUserId);
    await testDischarge(BASE, adminUserId);
    await testDispensing(BASE, adminUserId);
    await testInpatient(BASE, adminUserId);
    await testFhir(BASE, adminUserId);
  } catch (err) {
    console.error('\nTest suite crashed:', err.message);
    process.exit(1);
  }

  const { passed, failed, failures } = getStats();

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailed:');
    failures.forEach((f) => console.log(`  • ${f}`));
  }
  console.log('─'.repeat(55));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Runner error:', err);
  process.exit(1);
});
