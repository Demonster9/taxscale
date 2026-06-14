/**
 * pdfGenerator.js
 * Generates a branded "Tax Advisory Report" PDF using Puppeteer.
 */

'use strict';

const puppeteer = require('puppeteer');

// ── Helpers ───────────────────────────────────────────────────────────────────
const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const pct = (n) => (n || 0).toFixed(1) + '%';
const today = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const maskPAN = (pan) => {
  if (!pan) return '—';
  const str = String(pan).trim();
  if (!str) return '—';
  if (str.startsWith('*')) return str;
  const last4 = str.slice(-4);
  return `****${last4}`;
};

const safeName = (data) => data.taxpayerName || data.userName || data.name || 'Taxpayer';

const slabTable = (slabs) => {
  if (!Array.isArray(slabs) || slabs.length === 0) {
    return '<tr><td colspan="3" style="color:#8A8A9E;text-align:center;">No slab data available</td></tr>';
  }
  return slabs.map((s) => `
    <tr class="${(s.tax || 0) > 0 ? 'hit' : ''}">
      <td>${s.range || s.label || '—'}</td>
      <td>${s.rate || '—'}</td>
      <td class="num">${inr(s.tax)}</td>
    </tr>`).join('');
};

// ── HTML template ─────────────────────────────────────────────────────────────
function buildReportHTML(data) {
  const userName  = safeName(data);
  const maskedPAN = maskPAN(data.pan);
  const { assessmentYear, metrics = {}, newRegime = {}, oldRegime = {}, regimeSuggested } = data;

  const netSavings   = Math.abs((newRegime.totalTax || 0) - (oldRegime.totalTax || 0));
  const isNewOptimal = regimeSuggested === 'new';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>TaxScale Advisory Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 0; }
  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1A1A2E; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cover { background: #09090E; color: #EDE8DF; padding: 40px 48px 32px; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo-mark { width: 36px; height: 36px; background: #E8C547; display: inline-flex; align-items: center; justify-content: center; font-family: 'DM Serif Display', serif; font-size: 14px; color: #09090E; margin-bottom: 10px; }
  .logo-name { font-family: 'DM Serif Display', serif; font-size: 22px; letter-spacing: 0.01em; color: #EDE8DF; display: block; }
  .logo-sub { font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; color: #3A3A4E; display: block; margin-top: 3px; }
  .cover-meta { text-align: right; }
  .cover-meta .label { font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: #3A3A4E; display: block; margin-bottom: 3px; }
  .cover-meta .value { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #7A7A8E; }
  .advisory-band { background: ${isNewOptimal ? '#0F0E0A' : '#0A0F0E'}; border-top: 3px solid #E8C547; padding: 22px 48px; display: flex; align-items: center; justify-content: space-between; }
  .advisory-badge { font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; background: rgba(232,197,71,0.12); color: #E8C547; border: 1px solid rgba(232,197,71,0.25); padding: 3px 8px; margin-right: 14px; }
  .advisory-headline { font-family: 'DM Serif Display', serif; font-size: 20px; color: #EDE8DF; }
  .savings-block { text-align: right; }
  .savings-label { font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: #3A3A4E; display: block; margin-bottom: 4px; }
  .savings-num { font-family: 'DM Serif Display', serif; font-size: 26px; color: #E8C547; }
  .content { padding: 28px 48px 40px; }
  .section-title { font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; color: #8A8A9E; border-bottom: 1px solid #E8E8F0; padding-bottom: 6px; margin-bottom: 14px; margin-top: 24px; }
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid #E8E8F0; }
  .info-cell { padding: 10px 14px; border-right: 1px solid #E8E8F0; }
  .info-cell:last-child { border-right: none; }
  .info-label { font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: #8A8A9E; display: block; margin-bottom: 4px; }
  .info-value { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #1A1A2E; font-weight: 500; }
  .income-table { width: 100%; border-collapse: collapse; }
  .income-table th { font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: #8A8A9E; text-align: left; padding: 6px 10px; border-bottom: 1px solid #E8E8F0; background: #FAFAFA; }
  .income-table th.num { text-align: right; }
  .income-table td { padding: 8px 10px; font-size: 11px; color: #3A3A4E; border-bottom: 1px solid #F2F2F8; }
  .income-table td.num { font-family: 'JetBrains Mono', monospace; text-align: right; }
  .income-table td.debit { color: #8A3A3A; }
  .income-table tr.total td { font-weight: 600; color: #1A1A2E; border-top: 1px solid #D0D0E0; border-bottom: 2px solid #1A1A2E; }
  .regime-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .regime-card { border: 1px solid #E0E0EE; padding: 16px; }
  .regime-card-name { font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: #8A8A9E; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .winner-badge { background: #E8C547; color: #09090E; font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; }
  .regime-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #F2F2F8; font-size: 10px; }
  .regime-row:last-of-type { border-bottom: none; }
  .regime-key { color: #5A5A7E; }
  .regime-val { font-family: 'JetBrains Mono', monospace; color: #3A3A5E; }
  .regime-val.debit { color: #8A3A3A; }
  .regime-total { display: flex; justify-content: space-between; border-top: 1px solid #D0D0E0; margin-top: 8px; padding-top: 8px; }
  .regime-total-key { font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: #5A5A7E; }
  .regime-total-val { font-family: 'DM Serif Display', serif; font-size: 18px; color: #1A1A2E; }
  .slab-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .slab-table { width: 100%; border-collapse: collapse; }
  .slab-table caption { font-size: 9px; font-weight: 600; text-align: left; color: #1A1A2E; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
  .slab-table th { font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: #8A8A9E; text-align: left; padding: 5px 8px; border-bottom: 1px solid #E8E8F0; background: #FAFAFA; }
  .slab-table th.num { text-align: right; }
  .slab-table td { padding: 5px 8px; font-size: 10px; color: #8A8A9E; border-bottom: 1px solid #F4F4FA; font-family: 'JetBrains Mono', monospace; }
  .slab-table tr.hit td { color: #3A3A5E; }
  .slab-table td.num { text-align: right; }
  .footnote-block { margin-top: 24px; padding: 12px 16px; border-left: 3px solid #E8C547; background: #FAFAF4; }
  .footnote-block p { font-size: 9px; color: #6A6A7E; font-style: italic; line-height: 1.6; margin-bottom: 4px; }
  .next-steps-list { list-style: none; margin: 0; padding: 0; }
  .next-steps-list li { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #F2F2F8; font-size: 11px; color: #3A3A5E; line-height: 1.5; }
  .next-steps-bullet { flex-shrink: 0; width: 18px; height: 18px; background: #E8C547; color: #09090E; font-size: 8px; font-weight: 600; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .footer { background: #FAFAFA; border-top: 1px solid #E8E8F0; padding: 14px 48px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #9A9AAE; }
  .footer strong { color: #5A5A7E; }
  .page-break { page-break-before: always; }
  .no-break    { page-break-inside: avoid; }
</style>
</head>
<body>

<div class="cover">
  <div>
    <div class="logo-mark">TS</div>
    <span class="logo-name">TaxScale</span>
    <span class="logo-sub">Automated Tax Optimization Engine</span>
  </div>
  <div class="cover-meta">
    <span class="label">Report Generated</span>
    <span class="value">${today()}</span>
    <br><br>
    <span class="label">Assessment Year</span>
    <span class="value">AY ${assessmentYear || '2026-27'}</span>
    <br><br>
    <span class="label">Document Type</span>
    <span class="value">Tax Advisory Report</span>
  </div>
</div>

<div class="advisory-band">
  <div style="display:flex; align-items:center;">
    <span class="advisory-badge">Advisory</span>
    <span class="advisory-headline">File under the ${isNewOptimal ? 'New' : 'Old'} Tax Regime</span>
  </div>
  <div class="savings-block">
    <span class="savings-label">Potential Annual Savings</span>
    <span class="savings-num">${inr(netSavings)}</span>
  </div>
</div>

<div class="content">

  <div class="section-title">Taxpayer Details</div>
  <div class="info-grid no-break">
    <div class="info-cell">
      <span class="info-label">Name</span>
      <span class="info-value">${userName}</span>
    </div>
    <div class="info-cell">
      <span class="info-label">PAN (masked)</span>
      <span class="info-value">${maskedPAN}</span>
    </div>
    <div class="info-cell">
      <span class="info-label">Assessment Year</span>
      <span class="info-value">AY ${assessmentYear || '2026-27'}</span>
    </div>
    <div class="info-cell">
      <span class="info-label">Report Date</span>
      <span class="info-value">${today()}</span>
    </div>
  </div>

  <div class="section-title">Income &amp; Deduction Summary</div>
  <table class="income-table no-break">
    <thead>
      <tr>
        <th>Component</th>
        <th class="num">Amount</th>
        <th>Applicable Regime</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Gross Salary</td>
        <td class="num">${inr(metrics.grossSalary)}</td>
        <td>Both</td>
      </tr>
      <tr>
        <td>Standard Deduction</td>
        <td class="num debit">−${inr(50000)}</td>
        <td>Old only</td>
      </tr>
      <tr>
        <td>Standard Deduction (New Regime)</td>
        <td class="num debit">−${inr(75000)}</td>
        <td>New only</td>
      </tr>
      ${metrics.hraExemption ? `<tr>
        <td>HRA Exemption</td>
        <td class="num debit">−${inr(metrics.hraExemption)}</td>
        <td>Old only</td>
      </tr>` : ''}
      ${metrics.section80C ? `<tr>
        <td>Section 80C (PF / ELSS / LIC)</td>
        <td class="num debit">−${inr(metrics.section80C)}</td>
        <td>Old only</td>
      </tr>` : ''}
      <tr class="total">
        <td>Taxable Income — New Regime</td>
        <td class="num">${inr(newRegime.taxablePool)}</td>
        <td>—</td>
      </tr>
      <tr class="total">
        <td>Taxable Income — Old Regime</td>
        <td class="num">${inr(oldRegime.taxablePool)}</td>
        <td>—</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title" style="margin-top:28px;">Regime Comparison</div>
  <div class="regime-grid no-break">

    <div class="regime-card ${isNewOptimal ? 'winner' : ''}">
      <div class="regime-card-name">
        New Tax Regime
        ${isNewOptimal ? '<span class="winner-badge">Recommended ✦</span>' : ''}
      </div>
      <div class="regime-row">
        <span class="regime-key">Gross Income</span>
        <span class="regime-val">${inr(metrics.grossSalary)}</span>
      </div>
      <div class="regime-row">
        <span class="regime-key">Standard Deduction</span>
        <span class="regime-val debit">−${inr(newRegime.standardDeduction)}</span>
      </div>
      <div class="regime-row">
        <span class="regime-key">Taxable Income</span>
        <span class="regime-val">${inr(newRegime.taxablePool)}</span>
      </div>
      <div class="regime-row">
        <span class="regime-key">Base Slab Tax</span>
        <span class="regime-val">${inr(newRegime.baseTax)}</span>
      </div>
      ${newRegime.surcharge > 0 ? `
      <div class="regime-row" style="color: #b25e00; font-weight: 600;">
        <span class="regime-key">(+) High-Income Surcharge</span>
        <span class="regime-val">${inr(newRegime.surcharge)}</span>
      </div>` : ''}
      <div class="regime-row">
        <span class="regime-key">Health &amp; Edu Cess (4%)</span>
        <span class="regime-val">${inr(newRegime.cess)}</span>
      </div>
      <div class="regime-total">
        <span class="regime-total-key">Total Tax Payable *</span>
        <span class="regime-total-val">${inr(newRegime.totalTax)}</span>
      </div>
    </div>

    <div class="regime-card ${!isNewOptimal ? 'winner' : ''}">
      <div class="regime-card-name">
        Old Tax Regime
        ${!isNewOptimal ? '<span class="winner-badge">Recommended ✦</span>' : ''}
      </div>
      <div class="regime-row">
        <span class="regime-key">Gross Income</span>
        <span class="regime-val">${inr(metrics.grossSalary)}</span>
      </div>
      <div class="regime-row">
        <span class="regime-key">All Deductions</span>
        <span class="regime-val debit">
          −${inr((oldRegime.totalDeductions || 0) + (oldRegime.standardDeduction || 0))}
        </span>
      </div>
      <div class="regime-row">
        <span class="regime-key">Taxable Income</span>
        <span class="regime-val">${inr(oldRegime.taxablePool)}</span>
      </div>
      <div class="regime-row">
        <span class="regime-key">Base Slab Tax</span>
        <span class="regime-val">${inr(oldRegime.baseTax)}</span>
      </div>
      ${oldRegime.surcharge > 0 ? `
      <div class="regime-row" style="color: #b25e00; font-weight: 600;">
        <span class="regime-key">(+) High-Income Surcharge</span>
        <span class="regime-val">${inr(oldRegime.surcharge)}</span>
      </div>` : ''}
      <div class="regime-row">
        <span class="regime-key">Health &amp; Edu Cess (4%)</span>
        <span class="regime-val">${inr(oldRegime.cess)}</span>
      </div>
      <div class="regime-total">
        <span class="regime-total-key">Total Tax Payable *</span>
        <span class="regime-total-val">${inr(oldRegime.totalTax)}</span>
      </div>
    </div>
  </div>

  <div class="section-title" style="margin-top:28px;">Slab-wise Tax Breakdown</div>
  <div class="slab-wrap no-break">
    <table class="slab-table">
      <caption>New Regime Slabs</caption>
      <thead>
        <tr>
          <th>Threshold</th>
          <th>Rate</th>
          <th class="num">Tax</th>
        </tr>
      </thead>
      <tbody>${slabTable(newRegime.slabs)}</tbody>
    </table>

    <table class="slab-table">
      <caption>Old Regime Slabs</caption>
      <thead>
        <tr>
          <th>Threshold</th>
          <th>Rate</th>
          <th class="num">Tax</th>
        </tr>
      </thead>
      <tbody>${slabTable(oldRegime.slabs)}</tbody>
    </table>
  </div>

  <div class="footnote-block no-break">
    <p>* Calculations rounded to the nearest Rupee as per standard tax reporting norms.</p>
    <p>Note: This advisory is projected based on AY 2026-27 tax slabs; historical income data
       has been adjusted to reflect current tax regulations.</p>
  </div>

  <div class="section-title" style="margin-top:28px;">Recommended Next Steps</div>
  <ul class="next-steps-list no-break">
    <li><div class="next-steps-bullet">1</div><span>Verify your Form 26AS to match these figures.</span></li>
    <li><div class="next-steps-bullet">2</div><span>Check if your investments (80C, 80D) are fully utilized for the Old Regime.</span></li>
    <li><div class="next-steps-bullet">3</div><span>Consult a professional before final filing.</span></li>
  </ul>

</div><div class="footer">
  <span><strong>TaxScale</strong> — Automated Tax Optimization Engine</span>
  <span>Generated ${today()} &nbsp;·&nbsp; AY ${assessmentYear || '2026-27'}</span>
</div>

</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────
async function generatePDF(reportData) {
  const html = buildReportHTML(reportData);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await browser.close();
  }
}

module.exports = { generatePDF, buildReportHTML };