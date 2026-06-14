/**
 * auditLogger.js
 *
 * CHANGE 4: Server-side audit storage has been removed.
 * All session history is now maintained client-side via sessionStorage.
 *
 * This file is kept as a no-op stub so that any existing require() calls in
 * routes or controllers don't break. All exported functions are safe to call —
 * they simply do nothing and return empty/null values.
 *
 * You may safely delete this file if you remove all require('./auditLogger')
 * references from your backend routes.
 */

'use strict';

/**
 * logAnalysis — no-op stub.
 * Previously wrote to SQLite / NDJSON. Now a deliberate no-op.
 * Session history is handled entirely in the browser via sessionStorage.
 */
function logAnalysis(params) {
  // Intentionally empty — audit logging moved to client sessionStorage.
}

/**
 * getRecentLogs — returns an empty array.
 * The /api/reports route should be removed or updated to return { success: true, history: [] }
 * if any legacy code still calls it.
 */
function getRecentLogs(limit = 20) {
  return [];
}

/**
 * getStats — returns null.
 * No server-side stats are collected.
 */
function getStats() {
  return null;
}

module.exports = { logAnalysis, getRecentLogs, getStats };