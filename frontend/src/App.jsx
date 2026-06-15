import LandingPage from './components/LandingPage';
import { TAX_RULES, CURRENT_AY } from './config/taxSlabs';
import React, { useState, useEffect, useRef } from 'react';
import { Upload, AlertTriangle, RefreshCw, Download, Eye, EyeOff, CheckCircle, Info, AlertCircle } from 'lucide-react';
import Dashboard from './components/Dashboard';

// To this, to match the protocol dynamically:
const BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//localhost:5000`;

const FORM16_KEYWORDS = [
  'form 16', 'tds', 'employer', 'pan', 'gross salary',
  'assessment year', 'deductor', 'deductee', 'salary',
  'income tax', 'certificate', 'traces',
];

const CRITICAL_FIELDS = ['grossSalary'];

function validateExtractedText(rawText) {
  if (!rawText || rawText.trim().length < 50) {
    return { ok: false, reason: 'scanned' };
  }
  const lower = rawText.toLowerCase();
  const hasKeyword = FORM16_KEYWORDS.some(kw => lower.includes(kw));
  if (!hasKeyword) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true };
}

function getMissingCriticalFields(metrics) {
  return new Set(CRITICAL_FIELDS.filter(k => !metrics[k] || Number(metrics[k]) === 0));
}

// ── Session-only history helpers (sessionStorage) ────────────────────────────
const SESSION_HISTORY_KEY = 'tg_session_history';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

function loadSessionHistory() {
  try {
    const raw = sessionStorage.getItem(SESSION_HISTORY_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return all.filter(r => (r.date || '').slice(0, 10) === TODAY_ISO);
  } catch {
    return [];
  }
}

function saveSessionHistory(entry) {
  try {
    const existing = loadSessionHistory();
    const updated = [entry, ...existing].slice(0, 50);
    sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #09090E;
    color: #EDE8DF;
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1E1E2C; border-radius: 2px; }

  .tg-shell { min-height: 100vh; display: flex; flex-direction: column; }

  .tg-topbar {
    position: sticky; top: 0; z-index: 50; height: 52px;
    background: #09090E; border-bottom: 1px solid #18181F;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 28px;
  }

  .tg-logo-mark {
    width: 30px; height: 30px; background: #E8C547;
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Serif Display', serif; font-size: 13px;
    color: #09090E; flex-shrink: 0;
    cursor: pointer;
  }

  .tg-logo-name {
    font-family: 'DM Serif Display', serif; font-size: 17px;
    color: #EDE8DF; letter-spacing: 0.01em; line-height: 1;
    cursor: pointer;
  }

  .tg-logo-sub {
    font-size: 9px; color: #3A3A4E; letter-spacing: 0.1em;
    text-transform: uppercase; margin-top: 2px;
  }

  .tg-export-btn {
    display: flex; align-items: center; gap: 7px;
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    font-family: 'Inter', sans-serif; font-weight: 500;
    color: #09090E; background: #E8C547; border: none;
    padding: 7px 16px; cursor: pointer; transition: opacity 0.15s;
  }
  .tg-export-btn:hover { opacity: 0.85; }
  .tg-export-btn:disabled { opacity: 0.4; cursor: default; }

  .tg-main {
    display: grid; grid-template-columns: 272px 1fr;
    flex: 1; min-height: 0;
  }

  .tg-sidebar {
    border-right: 1px solid #18181F;
    display: flex; flex-direction: column;
    overflow-y: auto; padding-bottom: 32px;
  }

  .tg-section { padding: 20px 18px 0; }
  .tg-section-rule { height: 1px; background: #18181F; margin: 20px 0 0; }

  .tg-section-label {
    font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
    color: #6A6A7E; margin-bottom: 12px;
  }

  /* ── CHANGE 1: Secure Upload header row ── */
  .tg-section-label-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px;
  }
  .tg-secure-badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #E8C547; border: 1px solid rgba(232,197,71,0.25);
    padding: 2px 7px; font-family: 'Inter', sans-serif; font-weight: 500;
    background: rgba(232,197,71,0.06); flex-shrink: 0;
  }

  .tg-upload-zone {
    border: 1px dashed #252530; padding: 22px 12px; text-align: center;
    cursor: pointer; transition: border-color 0.15s;
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; background: transparent; width: 100%;
  }
  .tg-upload-zone:hover { border-color: #E8C547; }
  .tg-upload-zone-icon { color: #2E2E3E; width: 20px; height: 20px; transition: color 0.15s; }
  .tg-upload-zone:hover .tg-upload-zone-icon { color: #E8C547; }
  .tg-upload-filename { font-size: 11px; color: #EDE8DF; line-height: 1.4; word-break: break-all; }
  .tg-upload-filename.empty { color: #4A4A5E; }
  .tg-upload-hint { font-size: 10px; color: #252530; }

  .tg-upload-helper {
    margin-top: 8px;
    font-size: 10px; color: #3A3A4E; line-height: 1.55;
    padding: 0 2px;
  }
  .tg-upload-helper-icon {
    display: inline; vertical-align: middle;
    margin-right: 4px; color: #3A4A5E;
  }

  /* Privacy badge */
  .tg-privacy-badge {
    display: flex; align-items: center; gap: 6px;
    margin-top: 8px; padding: 7px 10px;
    background: rgba(60, 140, 80, 0.08);
    border: 1px solid rgba(60, 140, 80, 0.25);
    font-size: 10px; color: #5A9E70; line-height: 1.5;
  }
  .tg-privacy-badge-icon { flex-shrink: 0; font-size: 11px; }

  .tg-run-btn {
    display: flex; align-items: center; justify-content: center;
    gap: 7px; width: 100%; margin-top: 10px;
    background: #E8C547; color: #09090E; border: none; padding: 10px;
    font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
    font-family: 'Inter', sans-serif; font-weight: 500;
    cursor: pointer; transition: opacity 0.15s;
  }
  .tg-run-btn:hover { opacity: 0.85; }
  .tg-run-btn:disabled { opacity: 0.3; cursor: default; }

  .tg-error {
    margin-top: 8px; padding: 8px 10px;
    border: 1px solid rgba(180,60,60,0.3);
    background: rgba(180,60,60,0.06);
    color: #C47070; font-size: 10px;
    display: flex; gap: 7px; align-items: flex-start; line-height: 1.5;
  }

  .tg-pdf-error {
    margin-top: 10px;
    border: 1px solid rgba(200,90,50,0.35);
    background: rgba(200,90,50,0.06);
    padding: 11px 13px;
  }
  .tg-pdf-error-head {
    display: flex; align-items: center; gap: 7px;
    margin-bottom: 6px;
  }
  .tg-pdf-error-icon { color: #C46A50; flex-shrink: 0; }
  .tg-pdf-error-title {
    font-size: 11px; font-weight: 500; color: #C49070;
    letter-spacing: 0.01em;
  }
  .tg-pdf-error-body {
    font-size: 10px; color: #7A5A4E; line-height: 1.6;
  }
  .tg-pdf-error-tip {
    margin-top: 7px; padding-top: 7px;
    border-top: 1px solid rgba(200,90,50,0.2);
    font-size: 9px; color: #5A4040; letter-spacing: 0.01em;
  }

  /* ── Slider styles ── */
  .tg-simulator-section { position: relative; }

  /* Disabled overlay — sits over the sliders, pointer-events blocks interaction */
  .tg-slider-disabled-overlay {
    position: absolute; inset: 0; z-index: 10;
    cursor: not-allowed;
  }

  /* Tooltip shown on hover of the overlay */
  .tg-slider-disabled-overlay-tooltip {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: #111118; border: 1px solid #2E2E3E;
    padding: 8px 12px; font-size: 10px; color: #7A7A9E;
    line-height: 1.5; white-space: normal; max-width: 200px;
    z-index: 11; pointer-events: none; text-align: center;
    font-family: 'Inter', sans-serif; border-radius: 3px;
  }

  .tg-sliders-wrap {
    transition: opacity 0.2s;
  }
  .tg-sliders-wrap.dimmed {
    opacity: 0.45;
    pointer-events: none;
  }

  .tg-slider-regime-notice {
    margin-bottom: 10px; padding: 7px 10px;
    background: rgba(232,197,71,0.06);
    border: 1px solid rgba(232,197,71,0.18);
    font-size: 10px; color: #7A6E2A; line-height: 1.5;
    display: flex; align-items: flex-start; gap: 6px;
  }

  .tg-slider-row { margin-bottom: 15px; }
  .tg-slider-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .tg-slider-key { font-size: 10px; color: #8A8A9E; letter-spacing: 0.02em; }
  .tg-slider-val { font-size: 10px; font-family: 'JetBrains Mono', monospace; color: #E8C547; }

  input[type=range].tg-range {
    -webkit-appearance: none; width: 100%; height: 1px;
    background: #1E1E2A; outline: none; cursor: pointer;
  }
  input[type=range].tg-range::-webkit-slider-thumb {
    -webkit-appearance: none; width: 9px; height: 9px;
    background: #E8C547; border-radius: 50%; cursor: pointer;
  }

  .tg-delta-card {
    margin-top: 14px; background: #0D0D14;
    border: 1px solid #252530; padding: 12px 14px;
  }
  .tg-delta-tax {
    font-family: 'DM Serif Display', serif; font-size: 20px;
    color: #EDE8DF; transition: color 0.4s ease;
  }
  .tg-delta-tax.saving { color: #E8C547; }
  .tg-delta-bar-track {
    height: 4px; background: #252530;
    border-radius: 99px; overflow: hidden; margin: 8px 0;
  }
  .tg-delta-bar-fill {
    height: 100%; border-radius: 99px; background: #4A4A5E;
    transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s ease;
  }
  .tg-delta-bar-fill.saving { background: #E8C547; }
  .tg-delta-hint {
    font-size: 10px; color: #5A5A6E; min-height: 16px; transition: color 0.4s;
  }
  .tg-delta-hint.saving { color: #7A6E2A; }

  /* Session history note */
  .tg-session-note {
    margin-top: 14px; padding: 10px 12px;
    border: 1px solid #18181F; background: #0C0C13;
    font-size: 9px; color: #3A3A4E; line-height: 1.6;
    letter-spacing: 0.01em;
  }

  .tg-log-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 0; border-bottom: 1px solid #121218; cursor: pointer;
    background: none; border-top: none; border-left: none; border-right: none;
    width: 100%; text-align: left; transition: all 0.12s;
  }
  .tg-log-item:hover .tg-log-name { color: #E8C547; }
  .tg-log-name {
    font-size: 10px; color: #6A6A7E; font-family: 'JetBrains Mono', monospace;
    transition: color 0.12s; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; max-width: 160px;
  }
  .tg-log-date { font-size: 9px; color: #4A4A5E; flex-shrink: 0; }

  .tg-canvas { padding: 28px 32px; overflow-y: auto; background: #09090E; }

  .tg-empty {
    height: 100%; min-height: 400px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 0;
  }

  .tg-empty-inner {
    display: flex; flex-direction: column; align-items: center;
    border: 1px dashed #1E1E2A; padding: 40px 48px; max-width: 380px;
    text-align: center;
  }

  .tg-empty-icon {
    width: 40px; height: 40px; border: 1px solid #252530;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 18px; color: #3A3A4E;
  }

  .tg-empty-title {
    font-family: 'DM Serif Display', serif; font-size: 17px;
    color: #5A5A6E; margin-bottom: 8px; letter-spacing: 0.01em;
  }

  .tg-empty-body {
    font-size: 11px; color: #3A3A4E; line-height: 1.7;
    letter-spacing: 0.01em;
  }

  .tg-empty-steps {
    margin-top: 20px; display: flex; flex-direction: column; gap: 6px;
    width: 100%; text-align: left;
  }

  .tg-empty-step {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 10px; color: #3A3A4E; line-height: 1.5;
  }

  .tg-empty-step-num {
    font-family: 'JetBrains Mono', monospace; font-size: 9px;
    color: #E8C547; opacity: 0.5; flex-shrink: 0; margin-top: 1px;
    letter-spacing: 0.06em;
  }

  /* ── CHANGE 2: Loading state sub-text ── */
  .tg-loading-sub {
    font-size: 10px; color: #3A3A4E; letter-spacing: 0.04em;
    margin-top: 2px;
  }

  .tg-preload-box {
    max-width: 440px; border: 1px solid rgba(232,197,71,0.25);
    background: #0D0D14; padding: 32px 24px; text-align: center;
  }
  .tg-preload-title { font-family: 'DM Serif Display', serif; font-size: 20px; color: #EDE8DF; margin-bottom: 8px; }
  .tg-preload-filename { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #E8C547; margin-bottom: 24px; word-break: break-all; }

  .tg-advisory {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 22px; border-bottom: 1px solid #18181F; margin-bottom: 22px;
  }
  .tg-advisory-left { display: flex; align-items: baseline; gap: 14px; }
  .tg-advisory-badge {
    font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
    background: rgba(232,197,71,0.1); color: #E8C547;
    border: 1px solid rgba(232,197,71,0.2); padding: 3px 8px;
  }
  .tg-advisory-headline {
    font-family: 'DM Serif Display', serif; font-size: 24px;
    color: #EDE8DF; letter-spacing: 0.01em;
  }
  .tg-savings-block { text-align: right; }
  .tg-savings-label {
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #6A6A7E; margin-bottom: 4px;
  }
  .tg-savings-num {
    font-family: 'DM Serif Display', serif; font-size: 30px;
    color: #E8C547; letter-spacing: -0.01em;
  }

  .tg-tds-card {
    border: 1px solid rgba(100,140,255,0.18);
    background: rgba(100,140,255,0.04);
    padding: 16px 20px; margin-bottom: 20px;
  }
  .tg-tds-header {
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #5A7ADF; margin-bottom: 12px;
    display: flex; align-items: center; gap: 7px;
  }
  .tg-tds-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 5px 0; border-bottom: 1px solid rgba(100,140,255,0.08); font-size: 11px;
  }
  .tg-tds-row:last-child { border-bottom: none; }
  .tg-tds-key { color: #5A6A8E; }
  .tg-tds-val { font-family: 'JetBrains Mono', monospace; color: #8A9ABE; }
  .tg-tds-refund-row {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-top: 10px; padding-top: 10px;
    border-top: 1px solid rgba(100,140,255,0.2);
  }
  .tg-tds-refund-key {
    font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #5A7ADF;
  }
  .tg-tds-refund-val {
    font-family: 'DM Serif Display', serif; font-size: 22px; color: #7A9EFF;
  }
  .tg-tds-refund-val.payable { color: #C47070; }
  .tg-tds-note {
    font-size: 10px; color: #3A4A6E; margin-top: 8px; line-height: 1.5;
  }

  .tg-disclosure-row {
    display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;
  }
  .tg-disclosure-pill {
    font-size: 10px; padding: 5px 12px;
    border: 1px solid #18181F; color: #4A4A5E;
    display: flex; align-items: center; gap: 5px;
  }
  .tg-disclosure-pill.ok { border-color: rgba(60,160,90,0.3); color: #5A8A6E; }
  .tg-disclosure-pill.warn { border-color: rgba(196,120,60,0.3); color: #8A6A3E; }

  .tg-regime-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 20px; }
  .tg-regime-card { background: #0D0D14; padding: 18px 20px; border: 1px solid #18181F; }
  .tg-regime-card.active { border-color: rgba(232,197,71,0.35); background: #0F0E0A; }
  .tg-regime-name {
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #6A6A7E; margin-bottom: 14px;
  }
  .tg-regime-card.active .tg-regime-name { color: #7A6E2A; }

  .tg-ledger-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 5px 0; border-bottom: 1px solid #131318;
  }
  .tg-ledger-row:last-child { border-bottom: none; }
  .tg-ledger-key { font-size: 11px; color: #6A6A7E; }
  .tg-ledger-val { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #5A5A6E; }
  .tg-ledger-val.debit { color: #7A3A3A; }
  .tg-ledger-total-row {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-top: 10px; padding-top: 10px; border-top: 1px solid #18181F;
  }
  .tg-ledger-total-key {
    font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #7A7A8E;
  }
  .tg-ledger-total-val { font-family: 'DM Serif Display', serif; font-size: 20px; color: #EDE8DF; }
  .tg-regime-card.active .tg-ledger-total-val { color: #E8C547; }

  /* Old Regime Safety Gate */
  .tg-safety-gate {
    margin-top: 14px; padding: 12px 14px;
    background: rgba(230, 180, 60, 0.10);
    border: 1px solid rgba(230, 180, 60, 0.35);
    border-left: 3px solid #E8A847;
  }
  .tg-safety-gate-text {
    font-size: 10px; color: #B8902A; line-height: 1.65;
  }
  .tg-safety-gate-text strong { color: #C8A040; font-weight: 600; }

  .tg-toggle-wrap { display: flex; justify-content: center; margin: 4px 0 16px; }
  .tg-toggle-btn {
    display: flex; align-items: center; gap: 7px;
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: #6A6A7E; background: none; border: 1px solid #18181F;
    padding: 7px 16px; cursor: pointer; font-family: 'Inter', sans-serif;
    transition: color 0.15s, border-color 0.15s;
  }
  .tg-toggle-btn:hover { color: #EDE8DF; border-color: #2E2E3E; }

  .tg-detail-wrap { border: 1px solid #18181F; background: #0D0D14; }
  .tg-tabs { display: flex; border-bottom: 1px solid #18181F; }
  .tg-tab {
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    color: #6A6A7E; padding: 12px 18px; background: none; border: none;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    cursor: pointer; font-family: 'Inter', sans-serif; transition: color 0.15s;
  }
  .tg-tab.on { color: #E8C547; border-bottom-color: #E8C547; }
  .tg-tab:hover:not(.on) { color: #7A7A8E; }
  .tg-tab-content { padding: 20px; }

  .tg-stage-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #18181F;
  }
  .tg-stage-label {
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #6A6A7E; margin-bottom: 12px;
  }
  .tg-stage-row {
    display: flex; justify-content: space-between;
    padding: 4px 0; border-bottom: 1px solid #0E0E16; font-size: 11px;
  }
  .tg-stage-key { color: #7A7A8E; display: flex; align-items: center; }
  .tg-stage-val { font-family: 'JetBrains Mono', monospace; color: #8A8A9E; }
  .tg-stage-val.debit { color: #7A3A3A; }
  .tg-stage-total-row {
    display: flex; justify-content: space-between;
    padding: 8px 0 4px; border-top: 1px solid #18181F; margin-top: 4px;
  }
  .tg-stage-total-key {
    font-size: 10px; color: #8A8A9E; letter-spacing: 0.04em;
    display: flex; align-items: center;
  }
  .tg-stage-total-val {
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    font-weight: 500; color: #EDE8DF;
  }
  .tg-stage-total-val.gold { color: #E8C547; }

  .tg-slab-label {
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #2E2E3E; margin-bottom: 10px;
  }
  .tg-slab-head {
    display: flex; padding: 5px 0;
    border-bottom: 1px solid #18181F; margin-bottom: 2px;
  }
  .tg-slab-col {
    font-size: 9px; letter-spacing: 0.08em;
    text-transform: uppercase; color: #5A5A6E;
  }
  .tg-slab-row { display: flex; padding: 6px 0; border-bottom: 1px solid #0E0E16; }
  .tg-slab-row:last-child { border-bottom: none; }
  .tg-slab-row.hit .tg-slab-thresh { color: #7A7A8E; }
  .tg-slab-row.hit .tg-slab-rate   { color: #7A7A8E; }
  .tg-slab-row.hit .tg-slab-tax    { color: #C4A882; }
  .tg-slab-thresh { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #5A5A6E; flex: 2.5; }
  .tg-slab-rate   { font-size: 10px; color: #5A5A6E; flex: 1; }
  .tg-slab-tax    { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #5A5A6E; flex: 1.5; text-align: right; }

  .tg-info-wrap {
    position: relative; display: inline-flex;
    align-items: center; margin-left: 5px;
  }
  .tg-info-icon {
    width: 13px; height: 13px; border-radius: 50%;
    border: 1px solid #2E2E3E; display: inline-flex;
    align-items: center; justify-content: center;
    cursor: default; font-size: 8px; color: #3A3A4E;
    font-style: normal; user-select: none; flex-shrink: 0;
    transition: border-color 0.15s, color 0.15s;
  }
  .tg-info-icon:hover { border-color: #5A5A6E; color: #7A7A8E; }
  .tg-info-tooltip {
    position: absolute; bottom: calc(100% + 6px); left: 50%;
    transform: translateX(-50%); background: #111118;
    border: 1px solid #252530; border-radius: 4px;
    padding: 7px 10px; font-size: 10px; color: #7A7A8E;
    line-height: 1.5; white-space: normal; max-width: 200px;
    z-index: 999; pointer-events: none; text-align: left;
    font-family: 'Inter', sans-serif; font-style: normal;
    text-transform: none; letter-spacing: normal;
  }

  .tg-warn-wrap {
    position: relative; display: inline-flex;
    align-items: center; margin-left: 5px;
  }
  .tg-warn-icon {
    width: 13px; height: 13px; border-radius: 50%;
    border: 1px solid rgba(196,80,60,0.5); display: inline-flex;
    align-items: center; justify-content: center;
    cursor: default; font-size: 8px; color: #C45040;
    font-style: normal; user-select: none; flex-shrink: 0;
    animation: tg-warn-pulse 2s ease-in-out infinite;
  }
  @keyframes tg-warn-pulse {
    0%, 100% { border-color: rgba(196,80,60,0.35); }
    50%        { border-color: rgba(196,80,60,0.85); }
  }
  .tg-warn-tooltip {
    position: absolute; bottom: calc(100% + 6px); left: 50%;
    transform: translateX(-50%); background: #180C0C;
    border: 1px solid rgba(196,80,60,0.4); border-radius: 4px;
    padding: 7px 10px; font-size: 10px; color: #C47070;
    line-height: 1.5; white-space: normal; max-width: 210px;
    z-index: 999; pointer-events: none; text-align: left;
    font-family: 'Inter', sans-serif; font-style: normal;
    text-transform: none; letter-spacing: normal;
  }

  .tg-verify-field.missing {
    border-color: rgba(196,80,60,0.45);
    background: rgba(196,80,60,0.04);
  }
  .tg-verify-field.missing .tg-verify-field-label { color: #A05050; }
  .tg-verify-field.missing .tg-verify-field-input {
    color: #C47070;
    border-bottom-color: rgba(196,80,60,0.4);
  }

  /* ── CHANGE 3: Disclaimer gold privacy tag ── */
  .tg-disclaimer {
    background: #0C0C13; border-top: 1px solid #18181F;
    padding: 11px 28px; display: flex; align-items: flex-start; gap: 10px;
  }
  .tg-disclaimer-icon { color: #3A3A4E; flex-shrink: 0; margin-top: 1px; }
  .tg-disclaimer-text {
    font-size: 10px; color: #3A3A4E; line-height: 1.6; letter-spacing: 0.01em;
  }
  .tg-disclaimer-text strong { color: #4A4A5E; font-weight: 500; }
  .tg-disclaimer-privacy-tag {
    color: #E8C547; font-weight: 600; font-style: normal;
    letter-spacing: 0.01em;
  }
  .tg-disclaimer-privacy-sentence {
    color: #5A5A6E;
  }

  .tg-verify-wrap { max-width: 680px; margin: 0 auto; }
  .tg-verify-header {
    display: flex; align-items: baseline; gap: 14px;
    padding-bottom: 20px; border-bottom: 1px solid #18181F; margin-bottom: 24px;
  }
  .tg-verify-badge {
    font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
    background: rgba(100,140,255,0.08); color: #7A9EFF;
    border: 1px solid rgba(100,140,255,0.18); padding: 3px 8px; flex-shrink: 0;
  }
  .tg-verify-headline {
    font-family: 'DM Serif Display', serif; font-size: 22px;
    color: #EDE8DF; letter-spacing: 0.01em;
  }
  .tg-verify-sub { font-size: 11px; color: #4A4A5E; margin-top: 4px; line-height: 1.5; }
  .tg-verify-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 24px;
  }
  .tg-verify-field { background: #0D0D14; border: 1px solid #18181F; padding: 14px 16px; }
  .tg-verify-field-label {
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: #4A4A5E; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;
  }
  .tg-verify-field-input {
    width: 100%; background: transparent; border: none;
    border-bottom: 1px solid #252530; padding: 4px 0;
    font-family: 'JetBrains Mono', monospace; font-size: 13px;
    color: #EDE8DF; outline: none; transition: border-color 0.15s;
  }
  .tg-verify-field-input:focus { border-bottom-color: #E8C547; }
  .tg-verify-field-hint { font-size: 9px; color: #3A3A4E; margin-top: 5px; }
  .tg-verify-notice {
    border: 1px solid rgba(100,140,255,0.15);
    background: rgba(100,140,255,0.04);
    padding: 12px 16px; margin-bottom: 24px;
    display: flex; gap: 10px; align-items: flex-start;
  }
  .tg-verify-notice-icon { color: #5A7ADF; flex-shrink: 0; margin-top: 1px; }
  .tg-verify-notice-text { font-size: 10px; color: #5A6A9E; line-height: 1.6; }
  .tg-verify-notice.warn {
    border-color: rgba(196,120,60,0.25);
    background: rgba(196,120,60,0.04);
  }
  .tg-verify-notice.warn .tg-verify-notice-icon { color: #C48050; }
  .tg-verify-notice.warn .tg-verify-notice-text { color: #7A5A3E; }

  .tg-verify-actions { display: flex; gap: 8px; }
  .tg-verify-confirm-btn {
    flex: 1; display: flex; align-items: center; justify-content: center;
    gap: 7px; background: #E8C547; color: #09090E; border: none;
    padding: 11px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
    font-family: 'Inter', sans-serif; font-weight: 500;
    cursor: pointer; transition: opacity 0.15s;
  }
  .tg-verify-confirm-btn:hover { opacity: 0.85; }
  .tg-verify-back-btn {
    display: flex; align-items: center; justify-content: center; gap: 7px;
    background: none; color: #6A6A7E; border: 1px solid #18181F;
    padding: 11px 20px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
    font-family: 'Inter', sans-serif; cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .tg-verify-back-btn:hover { color: #9A9AAE; border-color: #2E2E3E; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.8s linear infinite; }

  @media (max-width: 900px) {
    .tg-main { 
      display: flex;
      flex-direction: column;
      grid-template-columns: 1fr; 
    }
    
    .tg-canvas {
      order: 1;
      padding: 20px 16px;
    }
    
    .tg-sidebar { 
      order: 2;
      display: flex;
      flex-direction: column;
      border-right: none; 
      border-top: 1px solid #18181F; 
      padding-bottom: 24px;
      margin-top: 20px;
    }

    .tg-mobile-order-simulator { order: 1; }
    .tg-mobile-order-history   { order: 2; }
    .tg-mobile-order-upload    { order: 3; }
    
    .tg-regime-grid { grid-template-columns: 1fr; gap: 12px; }
    .tg-stage-grid  { grid-template-columns: 1fr; gap: 16px; }
    .tg-verify-grid { grid-template-columns: 1fr; gap: 12px; }
    .tg-topbar { padding: 0 16px; }
    
    .tg-advisory { 
      flex-direction: column; 
      align-items: flex-start; 
      gap: 12px; 
    }
    .tg-savings-block { text-align: left; }
  }
`;

const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const InfoTooltip = ({ text }) => {
  const [visible, setVisible] = useState(false);
  return (
    <span className="tg-info-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <i className="tg-info-icon">i</i>
      {visible && <span className="tg-info-tooltip">{text}</span>}
    </span>
  );
};

const WarnTooltip = ({ text }) => {
  const [visible, setVisible] = useState(false);
  return (
    <span className="tg-warn-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <i className="tg-warn-icon">!</i>
      {visible && <span className="tg-warn-tooltip">{text}</span>}
    </span>
  );
};

const PdfErrorCard = ({ reason }) => {
  const isScanned = reason === 'scanned';
  return (
    <div className="tg-pdf-error">
      <div className="tg-pdf-error-head">
        <AlertCircle size={13} className="tg-pdf-error-icon" />
        <span className="tg-pdf-error-title">
          {isScanned ? 'Scanned PDF Detected' : 'Invalid File'}
        </span>
      </div>
      <div className="tg-pdf-error-body">
        {isScanned
          ? 'Your Form 16 appears to be a scanned image. Please upload a text-based PDF or contact your employer for a digital copy.'
          : "This doesn't look like a valid Form 16. Please upload the Form 16 PDF provided by your employer."
        }
      </div>
      <div className="tg-pdf-error-tip">
        {isScanned
          ? 'Tip: Ask your HR / payroll team for the TRACES-generated digital Form 16.'
          : 'Tip: Form 16 is issued by your employer after the financial year ends. It is not a salary slip or offer letter.'
        }
      </div>
    </div>
  );
};

const PrivacyBadge = () => (
  <div className="tg-privacy-badge">
    <span className="tg-privacy-badge-icon">🔒</span>
    <span>
      Your data is processed in-memory and never stored. Your privacy is our priority.
    </span>
  </div>
);

const OldRegimeSafetyGate = () => (
  <div className="tg-safety-gate">
    <p className="tg-safety-gate-text">
      <strong>⚠️ Important:</strong> The Old Regime tax calculation relies on claiming
      deductions (HRA, 80C, etc.). Please ensure you have valid receipts and investment
      proofs to back these claims during tax filing. Failure to provide documentation
      can result in penalties.
    </p>
  </div>
);

const TdsReconciliationCard = ({ tdsDeducted, recommendedTax, isNewOptimal, grossSalary }) => {
  if (!tdsDeducted || tdsDeducted === 0) return null;
  if (grossSalary > 0 && tdsDeducted === grossSalary) return null;

  const diff     = tdsDeducted - recommendedTax;
  const isRefund = diff > 0;
  const amount   = Math.abs(diff);
  const regime   = isNewOptimal ? 'New Regime' : 'Old Regime';
  return (
    <div className="tg-tds-card">
      <div className="tg-tds-header">
        <Info size={12} />
        TDS Reconciliation — ITR Filing Summary
      </div>
      <div className="tg-tds-row">
        <span className="tg-tds-key">TDS deducted by employer (Form 16)</span>
        <span className="tg-tds-val">{inr(tdsDeducted)}</span>
      </div>
      <div className="tg-tds-row">
        <span className="tg-tds-key">Tax liability under {regime}</span>
        <span className="tg-tds-val">{inr(recommendedTax)}</span>
      </div>
      <div className="tg-tds-refund-row">
        <span className="tg-tds-refund-key">
          {isRefund ? 'Expected ITR refund' : 'Balance tax payable on ITR'}
        </span>
        <span className={`tg-tds-refund-val${!isRefund ? ' payable' : ''}`}>
          {inr(amount)}
        </span>
      </div>
      <div className="tg-tds-note">
        {isRefund
          ? `Your employer deducted ${inr(tdsDeducted)} as TDS. Filing under the ${regime} results in a lower liability — claim the ${inr(amount)} difference as a refund when you file your ITR.`
          : `Your employer deducted ${inr(tdsDeducted)} as TDS. Filing under the ${regime} results in a higher liability — pay the ${inr(amount)} balance before filing.`
        }
      </div>
    </div>
  );
};

const DisclosurePills = ({ taxableIncomeNew, grossSalary }) => {
  const rules              = TAX_RULES[CURRENT_AY];
  const rebateLimit        = rules.newRegime.rebateLimit;
  const surchargeThreshold = rules.newRegime.surchargeThreshold || 5000000;
  const rebateApplies      = taxableIncomeNew <= rebateLimit;
  const surchargeApplies   = grossSalary > surchargeThreshold;
  return (
    <div className="tg-disclosure-row">
      <span className={`tg-disclosure-pill${rebateApplies ? ' warn' : ' ok'}`}>
        {rebateApplies
          ? `Rebate u/s 87A: Applicable (income ≤ ${inr(rebateLimit)})`
          : `Rebate u/s 87A: Nil (income ${inr(taxableIncomeNew)} > ${inr(rebateLimit)} limit)`
        }
      </span>
      <span className={`tg-disclosure-pill${surchargeApplies ? ' warn' : ' ok'}`}>
        {surchargeApplies
          ? `Surcharge: Applicable (income > ${inr(surchargeThreshold)})`
          : `Surcharge: Nil (income < ${inr(surchargeThreshold)} threshold)`
        }
      </span>
    </div>
  );
};

const VerificationScreen = ({ pendingMetrics, missingFields, onConfirm, onBack }) => {
  const [editedMetrics, setEditedMetrics] = useState({ ...pendingMetrics });
  const hasMissing = missingFields && missingFields.size > 0;

  const fields = [
    { key: 'grossSalary',     label: 'Gross Salary',        hint: 'Part B — Total Salary (before deductions)' },
    { key: 'professionalTax', label: 'Professional Tax',       hint: 'Deducted by employer; usually ₹2,400 p.a.' },
    { key: 'hraExemption',    label: 'HRA Exemption',          hint: 'House Rent Allowance exempt under Sec 10(13A)' },
    { key: 'section80C',      label: 'Section 80C Investments', hint: 'PF, ELSS, LIC, PPF — max ₹1,50,000' },
    { key: 'section80D',      label: 'Section 80D Health',     hint: 'Medical insurance premium — max ₹25,000/₹50,000' },
    { key: 'section24b',      label: 'Section 24(b) Home Loan', hint: 'Home loan interest paid — max ₹2,00,000' },
  ];

  const handleChange = (key, raw) => {
    const val = raw.replace(/[^0-9]/g, '');
    setEditedMetrics(prev => ({ ...prev, [key]: Number(val) || 0 }));
  };

  return (
    <div className="tg-verify-wrap">
      <div className="tg-verify-header">
        <span className="tg-verify-badge">Step 2 of 2 — Verify</span>
        <div>
          <div className="tg-verify-headline">Confirm Extracted Figures</div>
          <div className="tg-verify-sub">
            Review the values parsed from your Form 16. Edit any figure before running the analysis.
          </div>
        </div>
      </div>

      <div className="tg-verify-grid">
        {fields.map(({ key, label, hint }) => {
          const isMissing = missingFields && missingFields.has(key);
          return (
            <div className={`tg-verify-field${isMissing ? ' missing' : ''}`} key={key}>
              <div className="tg-verify-field-label">
                {label}
                {isMissing && (
                  <WarnTooltip text="Could not read this value. Please check your Form 16 and enter it manually." />
                )}
              </div>
              <input
                className="tg-verify-field-input"
                type="text"
                inputMode="numeric"
                value={editedMetrics[key] > 0 ? editedMetrics[key].toLocaleString('en-IN') : ''}
                placeholder={isMissing ? 'Enter manually' : '0'}
                onChange={e => handleChange(key, e.target.value.replace(/,/g, ''))}
              />
              <div className="tg-verify-field-hint">{hint}</div>
            </div>
          );
        })}
      </div>

      <div className={`tg-verify-notice${hasMissing ? ' warn' : ''}`}>
        {hasMissing
          ? <AlertCircle size={13} className="tg-verify-notice-icon" />
          : <Info size={13} className="tg-verify-notice-icon" />
        }
        <span className="tg-verify-notice-text">
          {hasMissing
            ? 'One or more critical fields (highlighted in red) could not be read from your PDF. Please enter them manually before confirming — leaving them at zero will produce incorrect calculations.'
            : 'These figures were extracted automatically and may contain OCR errors. Confirm that each value matches your physical Form 16 before proceeding.'
          }
        </span>
      </div>

      <div className="tg-verify-actions">
        <button className="tg-verify-back-btn" onClick={onBack}>
          ← Upload Different File
        </button>
        <button className="tg-verify-confirm-btn" onClick={() => onConfirm(editedMetrics)}>
          <CheckCircle size={13} />
          Confirm &amp; Run Analysis
        </button>
      </div>
    </div>
  );
};

const LegalDisclaimer = () => (
  <footer className="tg-disclaimer">
    <Info size={12} className="tg-disclaimer-icon" />
    <p className="tg-disclaimer-text">
      <strong className="tg-disclaimer-privacy-tag">🔒 Privacy First:</strong>{' '}
      <span className="tg-disclaimer-privacy-sentence">
        TaxScale runs entirely in your local browser. We do not store your documents,
        salary details, or personal data.
      </span>{' '}
      <br/>
      {/* ADD THIS LINK BLOCK BELOW */}
      <a 
        href="mailto:taxscale.support@gmail.com?subject=TaxScale Bug Report&body=Hi TaxScale Support, I encountered an issue. Here are the details:%0D%0A%0D%0A- Issue Description:%0D%0A- Expected Result:%0D%0A- (Optional) Please attach your Form 16 PDF if you are comfortable."
        style={{ color: '#E8C547', textDecoration: 'underline', cursor: 'pointer', marginRight: '5px' }}
      >
        Report a Bug
      </a>
      {" | "}
      <strong>Informational use only.</strong>{' '}
      TaxScale provides automated computations for indicative purposes and does{' '}
      <strong>not</strong> constitute professional tax, legal, or financial advice. Figures
      are derived from user-supplied inputs and applicable Indian Income Tax slabs as of
      AY {CURRENT_AY}; no warranty is made as to accuracy or completeness. Tax liability is
      subject to individual circumstances, surcharges, and provisions not captured here.{' '}
      <strong>Verify all figures with a qualified Chartered Accountant or tax professional
      before filing your return.</strong> Use of this tool does not create an
      advisor–client relationship.
    </p>
  </footer>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile]                           = useState(null);
  const [loading, setLoading]                     = useState(false);
  const [stage, setStage]                         = useState('idle');
  const [pendingMetrics, setPendingMetrics]       = useState(null);
  const [missingFields, setMissingFields]         = useState(new Set());
  const [pdfError, setPdfError]                   = useState(null);
  const [report, setReport]                       = useState(null);
  const [error, setError]                         = useState(null);
  const [exporting, setExporting]                 = useState(false);
  const [simulatedData, setSimulatedData]         = useState(null);
  const [simulatedAnalysis, setSimulatedAnalysis] = useState(null);
  const [showCalculations, setShowCalculations]   = useState(true);
  const [activeRegimeTab, setActiveRegimeTab]     = useState('new');
  const [fileInputKey, setFileInputKey]           = useState(Date.now());
  const [baselineTax, setBaselineTax]             = useState(null);
  const [tdsDeducted, setTdsDeducted]             = useState(0);
  const [view, setView]                           = useState('landing');

  const [sliderTooltipVisible, setSliderTooltipVisible] = useState(false);

  const reportCanvasRef = useRef(null);
  const fileInputRef    = useRef(null);

  const [history, setHistory]                     = useState(() => loadSessionHistory());

  const navigateTo = (newView) => {
    setView(newView);
    window.history.pushState({ view: newView }, '', '');
  };

  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ view: 'landing' }, '', '');
    }
    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        setView(event.state.view);
      } else {
        setView('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view, stage, activeRegimeTab]);

  const triggerAutoUpload = async (targetFile) => {
    setLoading(true); setError(null); setPdfError(null);
    setReport(null); setSimulatedData(null); setSimulatedAnalysis(null);
    setBaselineTax(null); setPendingMetrics(null); setMissingFields(new Set());
    setTdsDeducted(0);

    const formData   = new FormData();
    formData.append('form16', targetFile);
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${BASE_URL}/api/parse-form16`, {
        method: 'POST', body: formData, signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();

      if (data.success) {
        const rawText   = data.rawText || '';
        const textCheck = validateExtractedText(rawText);
        if (!textCheck.ok) {
          setPdfError(textCheck.reason); setFile(null); setFileInputKey(Date.now()); return;
        }

        const incoming = data.extractedData || data.data || {};
        const baseMetrics = {
          grossSalary:     Number(incoming.grossSalary     || incoming.Gross  || 0),
          professionalTax: Number(incoming.professionalTax || incoming.PT     || 0),
          hraExemption:    Number(incoming.hraExemption    || incoming.HRA    || 0),
          section80C:      Number(incoming.section80C      || incoming['80C'] || 0),
          section80D:      Number(incoming.section80D      || 0),
          section24b:      Number(incoming.section24b      || 0),
        };

        const parsedTds = Number(incoming.tdsDeducted || 0);
        const safeTds   = (parsedTds > 0 && parsedTds !== baseMetrics.grossSalary) ? parsedTds : 0;
        setTdsDeducted(safeTds);

        const missing = getMissingCriticalFields(baseMetrics);
        setReport(data); setPendingMetrics(baseMetrics);
        setMissingFields(missing); setStage('verify');
        setFile(targetFile);
        setFileInputKey(Date.now());
      } else {
        throw new Error(data.error || 'Parsing failed on server.');
      }
    } catch (err) {
  clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        // User-friendly version
        setError('The request took too long. Please check your internet connection and try again.');
      } else if (err.message === 'Failed to fetch') {
        // User-friendly version
        setError('We are having trouble connecting to our server. Please try again in a few moments.');
      } else {
        // User-friendly version
        setError('Something went wrong on our end. Please refresh the page and try again.');
      }
    } finally {
      setLoading(false);
    }
    
  };

  if (view === 'landing') {
    return (
      <LandingPage 
        onEnterDashboard={() => navigateTo('dashboard')} 
        onFileSelect={(selectedFile) => {
          if (!selectedFile) return;
          setFile(selectedFile);
          navigateTo('dashboard');
        }}
      />
    );
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setReport(null); setSimulatedData(null); setSimulatedAnalysis(null);
    setError(null); setPdfError(null); setBaselineTax(null);
    setPendingMetrics(null); setMissingFields(new Set());
    setTdsDeducted(0); setStage('idle');
    setFile(selectedFile);
  };

  // 🚀 FIXED: Native App.jsx Surcharge Math
  const calculateDetailedTax = (metrics) => {
    const rules = TAX_RULES[CURRENT_AY];
    const gross = Number(metrics.grossSalary || 0);
    const pt    = Number(metrics.professionalTax || 0);
    const hra   = Number(metrics.hraExemption || 0);
    const c80   = Number(metrics.section80C || 0);
    const d80   = Number(metrics.section80D || 0);
    const b24   = Number(metrics.section24b || 0);

    const calculateSlabTax = (income, slabs) => {
      let previousLimit = 0; let totalTax = 0; const breakdown = [];
      for (const slab of slabs) {
        const taxableAmount = Math.max(0, Math.min(income, slab.limit) - previousLimit);
        const tax = taxableAmount * slab.rate;
        breakdown.push({
          label: slab.limit === Infinity
            ? `Above ₹${previousLimit.toLocaleString('en-IN')}`
            : `₹${previousLimit.toLocaleString('en-IN')} - ₹${slab.limit.toLocaleString('en-IN')}`,
          rate: `${slab.rate * 100}%`, tax,
        });
        totalTax += tax; previousLimit = slab.limit;
        if (income <= slab.limit) break;
      }
      return { totalTax, breakdown };
    };

    const computeSurcharge = (taxableIncome, baseTax, isNewRegime = true) => {
        if (taxableIncome <= 5000000) return 0;
        if (taxableIncome > 5000000 && taxableIncome <= 10000000) return baseTax * 0.10;
        if (taxableIncome > 10000000 && taxableIncome <= 20000000) return baseTax * 0.15;
        if (taxableIncome > 20000000 && taxableIncome <= 50000000) return baseTax * 0.25;
        if (taxableIncome > 50000000) return isNewRegime ? baseTax * 0.25 : baseTax * 0.37;
        return 0;
    };

    const oldRules    = rules.oldRegime;
    const totalDedOld = pt + hra + c80 + d80 + b24;
    const poolOld     = Math.max(0, gross - oldRules.standardDeduction - totalDedOld);
    let oldResult     = calculateSlabTax(poolOld, oldRules.slabs);
    let oldBaseTax    = poolOld <= oldRules.rebateLimit ? 0 : oldResult.totalTax;
    const oldSurcharge = computeSurcharge(poolOld, oldBaseTax, false);
    const oldCess     = (oldBaseTax + oldSurcharge) * oldRules.cess;

    const newRules  = rules.newRegime;
    const poolNew   = Math.max(0, gross - newRules.standardDeduction);
    let newResult   = calculateSlabTax(poolNew, newRules.slabs);
    let newBaseTax  = poolNew <= newRules.rebateLimit ? 0 : newResult.totalTax;
    const newSurcharge = computeSurcharge(poolNew, newBaseTax, true);
    const newCess   = (newBaseTax + newSurcharge) * newRules.cess;

    return {
      newRegime: {
        taxablePool: poolNew, standardDeduction: newRules.standardDeduction,
        baseTax: newBaseTax, surcharge: newSurcharge, cess: newCess,
        totalTax: Math.round(newBaseTax + newSurcharge + newCess), slabs: newResult.breakdown,
      },
      oldRegime: {
        taxablePool: poolOld, standardDeduction: oldRules.standardDeduction,
        totalDeductions: totalDedOld, baseTax: oldBaseTax, surcharge: oldSurcharge, cess: oldCess,
        totalTax: Math.round(oldBaseTax + oldSurcharge + oldCess), slabs: oldResult.breakdown,
      },
    };
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true); setError(null); setPdfError(null);
    setReport(null); setSimulatedData(null); setSimulatedAnalysis(null);
    setBaselineTax(null); setPendingMetrics(null); setMissingFields(new Set());
    setTdsDeducted(0);

    const formData   = new FormData();
    formData.append('form16', file);
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${BASE_URL}/api/parse-form16`, {
        method: 'POST', body: formData, signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();

      if (data.success) {
        const rawText   = data.rawText || '';
        const textCheck = validateExtractedText(rawText);
        if (!textCheck.ok) {
          setPdfError(textCheck.reason); setFileInputKey(Date.now()); return; 
        }

        const incoming = data.extractedData || data.data || {};
        const baseMetrics = {
          grossSalary:     Number(incoming.grossSalary     || incoming.Gross  || 0),
          professionalTax: Number(incoming.professionalTax || incoming.PT     || 0),
          hraExemption:    Number(incoming.hraExemption    || incoming.HRA    || 0),
          section80C:      Number(incoming.section80C      || incoming['80C'] || 0),
          section80D:      Number(incoming.section80D      || 0),
          section24b:      Number(incoming.section24b      || 0),
        };

        const parsedTds = Number(incoming.tdsDeducted || 0);
        const safeTds   = (parsedTds > 0 && parsedTds !== baseMetrics.grossSalary) ? parsedTds : 0;
        setTdsDeducted(safeTds);

        const missing = getMissingCriticalFields(baseMetrics);
        setReport(data); setPendingMetrics(baseMetrics);
        setMissingFields(missing); setStage('verify');
        setFileInputKey(Date.now());
      } else {
        throw new Error(data.error || 'Parsing failed on server.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setError('Connection timed out. Is your local server running on port 5000?');
      } else if (err.message === 'Failed to fetch') {
        setError('Cannot reach the server. Check that it is running on port 5000 and the protocol matches.');
      } else {
        setError(err.message || 'Gateway offline. Check local server logs.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyConfirm = (confirmedMetrics) => {
    const initialAnalysis = calculateDetailedTax(confirmedMetrics);
    setSimulatedData(confirmedMetrics);
    setSimulatedAnalysis(initialAnalysis);
    setBaselineTax(initialAnalysis.oldRegime.totalTax);
    setStage('analysis');

    const entry = {
      filename:      file?.name || 'Form 16',
      date:          new Date().toISOString(),
      extractedData: confirmedMetrics,
    };
    saveSessionHistory(entry);
    setHistory(loadSessionHistory());
  };

  const handleVerifyBack = () => {
    setPendingMetrics(null); setMissingFields(new Set());
    setPdfError(null); setTdsDeducted(0); setStage('idle');
  };

  const handleSliderChange = (field, value) => {
    const updated = { ...simulatedData, [field]: Number(value) };
    setSimulatedData(updated);
    setSimulatedAnalysis(calculateDetailedTax(updated));
  };

  const handleHistoryItemClick = (record) => {
    if (record.extractedData) {
      setError(null); setPdfError(null);
      const initialAnalysis = calculateDetailedTax(record.extractedData);
      setSimulatedData(record.extractedData);
      setSimulatedAnalysis(initialAnalysis);
      setBaselineTax(initialAnalysis.oldRegime.totalTax);
      const histTds   = Number(record.extractedData?.tdsDeducted || 0);
      const grossHist = Number(record.extractedData?.grossSalary || 0);
      setTdsDeducted((histTds > 0 && histTds !== grossHist) ? histTds : 0);
      setStage('analysis');
    }
  };

  const exportPDFSummary = async () => {
    if (!analysis || !metrics) return;
    setExporting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/export-pdf`,  {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: 'Taxpayer', pan: '****1234', assessmentYear: CURRENT_AY,
          metrics, newRegime: analysis.newRegime, oldRegime: analysis.oldRegime,
          regimeSuggested: isNewOptimal ? 'new' : 'old', tdsDeducted,
          refundDue:        tdsDeducted > 0 ? Math.max(0, tdsDeducted - (isNewOptimal ? taxNew : taxOld)) : 0,
          additionalTaxDue: tdsDeducted > 0 ? Math.max(0, (isNewOptimal ? taxNew : taxOld) - tdsDeducted) : 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob   = await res.blob();
      const url    = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href  = url;
      anchor.download = `TaxScale_Report_AY${CURRENT_AY}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[exportPDF]', err);
    } finally {
      setExporting(false);
    }
  };

  const metrics        = simulatedData;
  const analysis       = simulatedAnalysis;
  const taxNew         = analysis?.newRegime?.totalTax || 0;
  const taxOld         = analysis?.oldRegime?.totalTax || 0;
  const netSavings     = Math.abs(taxNew - taxOld);
  const isNewOptimal   = taxNew < taxOld;
  const recommendedTax = isNewOptimal ? taxNew : taxOld;

  const slidersDisabled = activeRegimeTab === 'new';

  const getHistoryLabel = (record, index) => {
    const raw = record.filename || '';
    if (!raw || raw === 'Form 16' || raw.toLowerCase().startsWith('session_')) {
      return index === 0 ? 'Current Session Upload' : `Form 16 — Upload ${index + 1}`;
    }
    return raw;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="tg-shell">

        {/* TOPBAR */}
        <header className="tg-topbar">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div className="tg-logo-mark" onClick={() => navigateTo('landing')}>TS</div>
            <div>
              <div className="tg-logo-name" onClick={() => navigateTo('landing')}>
                TaxScale <span style={{color: '#E8C547', fontSize: '12px'}}></span>
              </div>
              <div className="tg-logo-sub">Automated Optimization Engine</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {analysis && (
              <button className="tg-export-btn" onClick={exportPDFSummary} disabled={exporting}>
                <Download size={13} />
                {exporting ? 'Generating…' : 'Export PDF'}
              </button>
            )}
          </div>
        </header>

        {/* MAIN */}
        <div className="tg-main">

          {/* SIDEBAR */}
          <aside className="tg-sidebar">
            
            {/* UPLOAD ZONE */}
            <div className="tg-section tg-mobile-order-upload" style={{ paddingTop:22 }}>
              <div className="tg-section-label-row">
                <span className="tg-section-label" style={{ marginBottom:0 }}>Upload Document</span>
                <span className="tg-secure-badge">🔒 Secure Upload</span>
              </div>
              <form onSubmit={handleUpload}>
                <label className="tg-upload-zone">
                  <Upload className="tg-upload-zone-icon" />
                  <span className={`tg-upload-filename${file ? '' : ' empty'}`}>
                    {file ? file.name : 'Form 16 PDF Document'}
                  </span>
                  <span className="tg-upload-hint">Drop file or click to browse</span>
                  <input
                    key={fileInputKey} ref={fileInputRef}
                    type="file" accept=".pdf"
                    style={{ display:'none' }}
                    onChange={handleFileChange}
                  />
                </label>

                <PrivacyBadge />

                <p className="tg-upload-helper">
                  <Info size={10} className="tg-upload-helper-icon" />
                  Upload the Form 16 PDF received from your employer. Scanned or photo PDFs may not work correctly.
                </p>
                {pdfError && <PdfErrorCard reason={pdfError} />}
                {error && !pdfError && (
                  <div className="tg-error">
                    <AlertTriangle size={12} style={{ flexShrink:0, marginTop:1 }} />
                    <span>{error}</span>
                  </div>
                )}
                <button type="submit" className="tg-run-btn" disabled={!file || loading}>
                  {loading
                    ? <><RefreshCw size={12} className="spin" /> Processing…</>
                    : 'Calculate My Tax'
                  }
                </button>
              </form>
            </div>

            {/* WHAT-IF SIMULATOR */}
            {metrics && stage === 'analysis' && (
              <div className="tg-mobile-order-simulator">
                <div className="tg-section-rule" />
                <div className="tg-section">
                  <div className="tg-section-label">What-If Simulator</div>

                  <div className="tg-simulator-section">
                    {slidersDisabled && (
                      <div
                        className="tg-slider-disabled-overlay"
                        onMouseEnter={() => setSliderTooltipVisible(true)}
                        onMouseLeave={() => setSliderTooltipVisible(false)}
                      >
                        {sliderTooltipVisible && (
                          <span className="tg-slider-disabled-overlay-tooltip">
                            These deductions are not applicable under the New Tax Regime.
                          </span>
                        )}
                      </div>
                    )}

                    <div className="tg-slider-regime-notice">
                      <Info size={11} style={{ flexShrink:0, marginTop:1 }} />
                      {slidersDisabled
                        ? 'Switch to the Old Regime tab below to simulate deduction scenarios.'
                        : 'Adjusting sliders simulates different Old Regime deduction amounts in real time.'
                      }
                    </div>

                    <div className={`tg-sliders-wrap${slidersDisabled ? ' dimmed' : ''}`}>
                      {[
                        { label:'Sec 80C Investments', field:'section80C', max:150000, step:5000 },
                        { label:'Sec 80D Health Med',  field:'section80D', max:50000,  step:2000 },
                        { label:'Sec 24(b) Home Loan', field:'section24b', max:200000, step:5000 },
                      ].map(({ label, field, max, step }) => (
                        <div className="tg-slider-row" key={field}>
                          <div className="tg-slider-top">
                            <span className="tg-slider-key">{label}</span>
                            <span className="tg-slider-val">{inr(metrics[field] || 0)}</span>
                          </div>
                          <input
                            type="range" className="tg-range"
                            min="0" max={max} step={step}
                            value={metrics[field] || 0}
                            onChange={e => handleSliderChange(field, e.target.value)}
                            tabIndex={slidersDisabled ? -1 : 0}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const baseline  = baselineTax || taxOld;
                    const current   = taxOld;
                    const saved     = baseline - current;
                    const pct       = baseline > 0 ? Math.max(4, Math.round((current / baseline) * 100)) : 100;
                    const improving = saved > 100;
                    return (
                      <div className="tg-delta-card">
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                          <span style={{ fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase', color:'#3A3A4E' }}>Old Regime Tax</span>
                          <span className={`tg-delta-tax${improving ? ' saving' : ''}`}>{inr(current)}</span>
                        </div>
                        <div className="tg-delta-bar-track">
                          <div className={`tg-delta-bar-fill${improving ? ' saving' : ''}`} style={{ width: pct + '%' }} />
                        </div>
                        <div className={`tg-delta-hint${improving ? ' saving' : ''}`}>
                          {improving ? `${inr(saved)} saved vs original` : 'Switch to Old Regime tab to simulate'}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* SESSION HISTORY */}
            {history.length > 0 && (
              <div className="tg-mobile-order-history">
                <div className="tg-section-rule" />
                <div className="tg-section">
                  <div className="tg-section-label">Session History</div>
                  <div style={{ maxHeight:260, overflowY:'auto' }}>
                    {history.map((record, i) => (
                      <button key={i} className="tg-log-item" onClick={() => handleHistoryItemClick(record)}>
                        <span className="tg-log-name">{getHistoryLabel(record, i)}</span>
                        <span className="tg-log-date">
                          {new Date(record.date || Date.now()).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="tg-session-note">
                    This history is saved locally in your browser for this session only and is wiped when you close this window.
                  </p>
                </div>
              </div>
            )}
          </aside>

          {/* CANVAS */}
          <main className="tg-canvas">
            {stage === 'idle' && (
              <div className="tg-empty">
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <RefreshCw size={24} className="spin" style={{ color: '#E8C547' }} />
                    <span style={{ color: '#8A8A9E', fontSize: 11, letterSpacing: '0.05em' }}>
                      Securely parsing Form 16 in browser memory…
                    </span>
                    <span className="tg-loading-sub">No files are stored on our servers.</span>
                  </div>
                ) : (
                  <div className="tg-empty-inner">
                    <div className="tg-empty-icon">
                      <Upload size={18} />
                    </div>
                    <div className="tg-empty-title">Ready to calculate your tax</div>
                    <p className="tg-empty-body">
                      Upload your Form 16 on the left to instantly calculate your tax liability under both regimes and find out which one saves you more.
                    </p>
                    <div className="tg-empty-steps">
                      <div className="tg-empty-step">
                        <span className="tg-empty-step-num">01</span>
                        <span>Select your Form 16 PDF from the sidebar</span>
                      </div>
                      <div className="tg-empty-step">
                        <span className="tg-empty-step-num">02</span>
                        <span>Verify the extracted figures look correct</span>
                      </div>
                      <div className="tg-empty-step">
                        <span className="tg-empty-step-num">03</span>
                        <span>Get your regime recommendation and tax breakdown</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {stage === 'verify' && pendingMetrics && (
              <VerificationScreen
                pendingMetrics={pendingMetrics}
                missingFields={missingFields}
                onConfirm={handleVerifyConfirm}
                onBack={handleVerifyBack}
              />
            )}

            {stage === 'analysis' && analysis && (
              <div ref={reportCanvasRef} id="tax-report-canvas">

                <div className="tg-advisory">
                  <div className="tg-advisory-left">
                    <span className="tg-advisory-badge">Advisory</span>
                    <h2 className="tg-advisory-headline">
                      File under the {isNewOptimal ? 'New Regime' : 'Old Regime'}
                    </h2>
                  </div>
                  <div className="tg-savings-block">
                    <div className="tg-savings-label">Potential Annual Savings</div>
                    <div className="tg-savings-num">{inr(netSavings)}</div>
                  </div>
                </div>

                <DisclosurePills
                  taxableIncomeNew={analysis.newRegime?.taxablePool || 0}
                  grossSalary={metrics?.grossSalary || 0}
                />

                <TdsReconciliationCard
                  tdsDeducted={tdsDeducted}
                  recommendedTax={recommendedTax}
                  isNewOptimal={isNewOptimal}
                  grossSalary={metrics?.grossSalary || 0}
                />

                <div className="tg-regime-grid">
                  <div className={`tg-regime-card${!isNewOptimal ? ' active' : ''}`}>
                    <div className="tg-regime-name">Old Tax Regime{!isNewOptimal ? ' ✦' : ''}</div>
                    <div className="tg-ledger-row">
                      <span className="tg-ledger-key">Gross Income</span>
                      <span className="tg-ledger-val">{inr(metrics?.grossSalary)}</span>
                    </div>
                    <div className="tg-ledger-row">
                      <span className="tg-ledger-key">Deductions Applied</span>
                      <span className="tg-ledger-val debit">
                        −{inr((analysis?.oldRegime?.totalDeductions || 0) + (analysis?.oldRegime?.standardDeduction || 0))}
                      </span>
                    </div>
                    
                    {/* 🚀 SURCHARGE ROW */}
                    {analysis?.oldRegime?.surcharge > 0 && (
                      <div className="tg-ledger-row">
                        <span className="tg-ledger-key" style={{color:'#C4A882'}}>(+) High Surcharge</span>
                        <span className="tg-ledger-val" style={{color:'#E8C547'}}>{inr(analysis.oldRegime.surcharge)}</span>
                      </div>
                    )}

                    <div className="tg-ledger-total-row">
                      <span className="tg-ledger-total-key">Net Tax</span>
                      <span className="tg-ledger-total-val">{inr(taxOld)}</span>
                    </div>
                    <OldRegimeSafetyGate />
                  </div>

                  <div className={`tg-regime-card${isNewOptimal ? ' active' : ''}`}>
                    <div className="tg-regime-name">New Tax Regime{isNewOptimal ? ' ✦' : ''}</div>
                    <div className="tg-ledger-row">
                      <span className="tg-ledger-key">Gross Income</span>
                      <span className="tg-ledger-val">{inr(metrics?.grossSalary)}</span>
                    </div>
                    <div className="tg-ledger-row">
                      <span className="tg-ledger-key">Standard Deduction</span>
                      <span className="tg-ledger-val debit">−{inr(analysis?.newRegime?.standardDeduction)}</span>
                    </div>

                    {/* 🚀 SURCHARGE ROW */}
                    {analysis?.newRegime?.surcharge > 0 && (
                      <div className="tg-ledger-row">
                        <span className="tg-ledger-key" style={{color:'#C4A882'}}>(+) High Surcharge</span>
                        <span className="tg-ledger-val" style={{color:'#E8C547'}}>{inr(analysis.newRegime.surcharge)}</span>
                      </div>
                    )}

                    <div className="tg-ledger-total-row">
                      <span className="tg-ledger-total-key">Net Tax</span>
                      <span className="tg-ledger-total-val">{inr(taxNew)}</span>
                    </div>
                  </div>
                </div>

                <div className="tg-toggle-wrap">
                  <button type="button" className="tg-toggle-btn" onClick={() => setShowCalculations(!showCalculations)}>
                    {showCalculations ? <><EyeOff size={12} /> Hide Calculations</> : <><Eye size={12} /> Show Calculations</>}
                  </button>
                </div>

                {showCalculations && (
                  <div className="tg-detail-wrap">
                    <div className="tg-tabs">
                      {['new','old'].map(tab => (
                        <button
                          key={tab}
                          className={`tg-tab${activeRegimeTab === tab ? ' on' : ''}`}
                          onClick={() => setActiveRegimeTab(tab)}
                        >
                          {tab === 'new' ? 'New Regime' : 'Old Regime'}
                        </button>
                      ))}
                    </div>

                    {['new','old'].map(regime => {
                      if (activeRegimeTab !== regime) return null;
                      const r = regime === 'new' ? analysis?.newRegime : analysis?.oldRegime;
                      const deductionAmt = regime === 'new'
                        ? r?.standardDeduction || 0
                        : (r?.totalDeductions || 0) + (r?.standardDeduction || 0);
                      const dedLabel = regime === 'new' ? '(−) Standard Ded.' : '(−) Deductions Applied';
                      return (
                        <div key={regime} className="tg-tab-content">
                          <div className="tg-stage-grid">
                            <div>
                              <div className="tg-stage-label">Stage 1 — Taxable Income</div>
                              <div className="tg-stage-row">
                                <span className="tg-stage-key">Gross Baseline</span>
                                <span className="tg-stage-val">{inr(metrics?.grossSalary)}</span>
                              </div>
                              <div className="tg-stage-row">
                                <span className="tg-stage-key">{dedLabel}</span>
                                <span className="tg-stage-val debit">−{inr(deductionAmt)}</span>
                              </div>
                              <div className="tg-stage-total-row">
                                <span className="tg-stage-total-key">
                                  Net Taxable Income
                                  <InfoTooltip text="Gross income after all deductions; the amount tax slabs are applied to." />
                                </span>
                                <span className="tg-stage-total-val">{inr(r?.taxablePool)}</span>
                              </div>
                            </div>
                            <div>
                              <div className="tg-stage-label">Stage 2 — Tax Computation</div>
                              <div className="tg-stage-row">
                                <span className="tg-stage-key">Base Slab Tax</span>
                                <span className="tg-stage-val">{inr(r?.baseTax)}</span>
                              </div>

                              {/* 🚀 SURCHARGE ROW */}
                              {r?.surcharge > 0 && (
                                <div className="tg-stage-row">
                                  <span className="tg-stage-key" style={{color:'#C4A882'}}>
                                    (+) High Surcharge
                                    <InfoTooltip text="Surcharge applied on base tax for high-income earners." />
                                  </span>
                                  <span className="tg-stage-val" style={{color:'#E8C547'}}>{inr(r.surcharge)}</span>
                                </div>
                              )}

                              <div className="tg-stage-row">
                                <span className="tg-stage-key">
                                  (+) Health &amp; Edu Cess 4%
                                  <InfoTooltip text="4% surcharge on base tax, funding government health and education schemes." />
                                </span>
                                <span className="tg-stage-val">{inr(r?.cess)}</span>
                              </div>
                              <div className="tg-stage-total-row">
                                <span className="tg-stage-total-key">Total Net Due</span>
                                <span className={`tg-stage-total-val${regime === 'new' && isNewOptimal ? ' gold' : ''}`}>
                                  {inr(r?.totalTax)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="tg-slab-label">Slab-Wise Tax Breakdown</div>
                          <div className="tg-slab-head">
                            <span className="tg-slab-col" style={{ flex:2.5 }}>Slab Threshold</span>
                            <span className="tg-slab-col" style={{ flex:1 }}>Rate</span>
                            <span className="tg-slab-col" style={{ flex:1.5, textAlign:'right' }}>Segment Tax</span>
                          </div>
                          {(r?.slabs || []).map((row, idx) => (
                            <div key={idx} className={`tg-slab-row${row.tax > 0 ? ' hit' : ''}`}>
                              <span className="tg-slab-thresh">{row.label}</span>
                              <span className="tg-slab-rate">{row.rate}</span>
                              <span className="tg-slab-tax">{inr(row.tax)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        <LegalDisclaimer />
      </div>
    </>
  );
}