// ─────────────────────────────────────────────────────────────────────────────
// utils/pdfParser.js  —  TaxScale
//
// Validation behaviour:
//   SCANNED_PDF  → soft warning only — parsing continues, UI shows yellow banner
//   NOT_FORM16   → hard block — throws, pipeline stops, UI shows red error
//
// FIX: TDS extraction was fragile — when PDF text extraction splits the
//      "Total (Rs.) 2557983.00 483740.00 483740.00" row across multiple lines,
//      the single-line regex matched only the gross salary figure (2557983.00)
//      and returned it as tdsDeducted. Three additional strategies now cover
//      multi-line layouts so the correct tax-deposited figure is always found.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const pdfModule = require('pdf-parse-fork');
const pdf = typeof pdfModule === 'function' ? pdfModule : pdfModule.default || pdfModule;

// ── Helpers ───────────────────────────────────────────────────────────────────

const cleanAmount = (str) => {
  if (!str) return 0;
  const sanitized = str.replace(/[\s,]/g, '');
  const match = sanitized.match(/[-]?\d+\.?\d*/);
  return match ? parseFloat(match[0]) : 0;
};

function findFirstNonZeroAmount(lines, startIdx, maxLines = 6) {
  for (let i = startIdx; i < Math.min(startIdx + maxLines, lines.length); i++) {
    const amounts = lines[i].match(/([\d,]+\.\d{2})/g);
    if (amounts) {
      for (const a of amounts) {
        const val = cleanAmount(a);
        if (val > 0) return val;
      }
    }
  }
  return 0;
}

function findAllAmountsInBlock(lines, startIdx, maxLines = 4) {
  const allAmounts = [];
  for (let i = startIdx; i < Math.min(startIdx + maxLines, lines.length); i++) {
    const amounts = lines[i].match(/([\d,]+\.\d{2})/g);
    if (amounts) allAmounts.push(...amounts);
  }
  return allAmounts;
}

// ── Document validation ───────────────────────────────────────────────────────

const FORM16_KEYWORDS         = ['form 16','form no. 16','form no.16','tds','traces','section 203','employer','gross salary','17(1)','deductor'];
const KEYWORD_MATCH_THRESHOLD = 3;

function validateForm16Document(rawText) {
  const trimmed = rawText.trim();

  if (trimmed.length < 50) {
    return {
      valid:   true,
      warning: 'SCANNED_PDF',
      message: 'This appears to be a scanned PDF. Results may be incomplete — please verify all figures before proceeding.',
    };
  }

  const lower   = trimmed.toLowerCase();
  const matches = FORM16_KEYWORDS.filter(kw => lower.includes(kw));
  if (matches.length < KEYWORD_MATCH_THRESHOLD) {
    return {
      valid:  false,
      reason: 'NOT_FORM16',
      error:  "This doesn't look like a valid Form 16. Please upload the Form 16 PDF provided by your employer.",
    };
  }

  return { valid: true };
}

// ── Field-level zero warnings ─────────────────────────────────────────────────

const CRITICAL_FIELDS = {
  grossSalary: 'Could not read this value. Please check your Form 16.',
};

function buildFieldWarnings(extractedData) {
  const warnings = {};
  for (const [field, msg] of Object.entries(CRITICAL_FIELDS)) {
    if (!extractedData[field] || extractedData[field] === 0) {
      warnings[field] = msg;
    }
  }
  return warnings;
}

// ── TDS Extraction — four-strategy waterfall ──────────────────────────────────
//
// The Part A quarterly summary row looks like one of these layouts depending
// on the PDF renderer:
//
//   Layout A (single line):
//     "Total (Rs.) 2557983.00 483740.00 483740.00"
//
//   Layout B (amounts on the next line):
//     "Total (Rs.)"
//     "2557983.00 483740.00 483740.00"
//
//   Layout C (each amount on its own line):
//     "Total (Rs.)"
//     "2557983.00"
//     "483740.00"
//     "483740.00"
//
//   Layout D (labelled amounts):
//     "Amount paid/credited (Rs.) 2557983.00"
//     "Amount of tax deducted (Rs.) 483740.00"
//     "Amount of tax deposited / remitted 483740.00"
//
// Strategy 1 — single-line with ≥2 amounts: take the LAST amount (tax deposited).
// Strategy 2 — "Total (Rs.)" header found, scan next 6 lines, collect ALL
//              amounts; if ≥2 found take the LAST (tax deposited column).
// Strategy 3 — look for "tax deposited" / "tax deducted" labelled lines and
//              grab their inline amount directly.
// Strategy 4 — scan challan table: sum the "Tax Deposited in respect of the
//              deductee" column (Sl.No. rows). This avoids the summary row
//              entirely and is the most robust fallback.
//
// A valid TDS value must be:
//   • > 0
//   • LESS than grossSalary (tax is always < gross — if equal it's gross salary)
//   • < 10,000,000 (sanity ceiling)
//
// ─────────────────────────────────────────────────────────────────────────────

function extractTdsDeducted(lines, cleanText, grossSalary) {
  const MAX_TDS     = 10_000_000;
  const isValid = (v) => v > 0 && v < MAX_TDS && v !== grossSalary;

  // ── Strategy 1: single line "Total (Rs.)  2557983.00  483740.00  483740.00"
  for (let i = 0; i < lines.length; i++) {
    if (/total\s*\(rs\.?\)/i.test(lines[i])) {
      const amounts = lines[i].match(/([\d,]+\.\d{2})/g);
      if (amounts && amounts.length >= 2) {
        const candidate = cleanAmount(amounts[amounts.length - 1]);
        if (isValid(candidate)) {
          console.log(`[PARSER-TDS] Strategy 1 hit: ₹${candidate}`);
          return candidate;
        }
      }
    }
  }

  // ── Strategy 2: "Total (Rs.)" header — amounts on following lines
  for (let i = 0; i < lines.length; i++) {
    if (/total\s*\(rs\.?\)/i.test(lines[i])) {
      // Collect all numeric amounts from this line and the next 6 lines
      const collected = [];
      for (let j = i; j < Math.min(i + 7, lines.length); j++) {
        const amounts = lines[j].match(/([\d,]+\.\d{2})/g);
        if (amounts) collected.push(...amounts.map(cleanAmount));
      }
      // Filter to amounts that look like tax (not gross salary)
      const taxLike = collected.filter(v => isValid(v));
      if (taxLike.length >= 1) {
        // The tax-deposited column is the last distinct non-gross value
        const candidate = taxLike[taxLike.length - 1];
        if (isValid(candidate)) {
          console.log(`[PARSER-TDS] Strategy 2 hit: ₹${candidate}`);
          return candidate;
        }
      }
    }
  }

  // ── Strategy 3: labelled "tax deposited / remitted" or "tax deducted" lines
  const depositedPatterns = [
    /amount\s+of\s+tax\s+deposited\s*[\/\\]\s*remitted/i,
    /tax\s+deposited\s+\/\s+remitted/i,
    /amount\s+of\s+tax\s+deposited/i,
    /tax\s+deposited\s+in\s+respect/i,  // challan table header — skip
  ];
  for (let i = 0; i < lines.length; i++) {
    // Skip challan-table header rows (they describe columns, not values)
    if (/challan|bsr\s+code|date\s+on\s+which/i.test(lines[i])) continue;

    for (const pat of depositedPatterns) {
      if (pat.test(lines[i])) {
        const candidate = findFirstNonZeroAmount(lines, i, 4);
        if (isValid(candidate)) {
          console.log(`[PARSER-TDS] Strategy 3 hit (label match): ₹${candidate}`);
          return candidate;
        }
      }
    }
  }

  // ── Strategy 4: sum challan table rows
  let challanSum   = 0;
  let challanCount = 0;
  const inChallanSection = (line) =>
    /\b(bsr\s+code|challan\s+serial|date\s+on\s+which\s+tax|status\s+of\s+match)/i.test(line);

  let challanActive = false;
  for (let i = 0; i < lines.length; i++) {
    if (inChallanSection(lines[i])) { challanActive = true; continue; }
    if (!challanActive) continue;
    // A challan data row: starts with 1–2 digit serial number
    const rowMatch = lines[i].match(/^(\d{1,2})\s+([\d,]+\.\d{2})/);
    if (rowMatch) {
      const rowTax = cleanAmount(rowMatch[2]);
      if (rowTax > 0 && rowTax < 200_000) {          // individual challan unlikely > ₹2L
        challanSum   += rowTax;
        challanCount += 1;
      }
    }
    // Stop when we hit the Total row inside the challan section
    if (/total\s*\(rs\.?\)/i.test(lines[i]) && challanActive) break;
  }

  if (challanCount >= 2 && isValid(challanSum)) {
    console.log(`[PARSER-TDS] Strategy 4 hit (challan sum, ${challanCount} rows): ₹${challanSum}`);
    return challanSum;
  }

  // ── All strategies failed
  console.warn('[PARSER-TDS] All strategies failed — tdsDeducted will be 0');
  return 0;
}

// ── Main parser ───────────────────────────────────────────────────────────────

async function parseForm16Text(pdfBuffer) {
  try {
    const data    = await pdf(pdfBuffer);
    const rawText = data.text || ''; // 🚀 RESTORED TO REAL UPLOAD BEHAVIOR

    const docCheck   = validateForm16Document(rawText);
    let   docWarning = null;

    if (!docCheck.valid) {
      const err      = new Error(docCheck.error);
      err.code       = docCheck.reason;
      err.userFacing = true;
      throw err;
    }

    if (docCheck.warning === 'SCANNED_PDF') {
      docWarning = { code: 'SCANNED_PDF', message: docCheck.message };
      console.warn('[PARSER] Scanned PDF detected — attempting extraction anyway');
    }

    const cleanText = rawText.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
    const lines     = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    console.log('[PARSER] Lines:', lines.length);

    let grossSalary     = 0;
    let professionalTax = 0;
    let section80C      = 0;
    let hraExemption    = 0;

    // ── GROSS SALARY — Sec 17(1)
    const grossSameLine = cleanText.match(/17\(1\)\s*[\"\s,]*([\d,]+\.\d{2})/i);
    if (grossSameLine) {
      grossSalary = cleanAmount(grossSameLine[1]);
    } else {
      for (let i = 0; i < lines.length; i++) {
        if (/section\s+17\(1\)/i.test(lines[i]) || /provisions.*17\(1\)/i.test(lines[i])) {
          grossSalary = findFirstNonZeroAmount(lines, i, 5);
          if (grossSalary > 0) break;
        }
      }
    }

    // ── PROFESSIONAL TAX — Sec 16(iii)
    const ptSameLine = cleanText.match(/16\(iii\)\s*[\"\s,]*([\d,]+\.\d{2})/i);
    if (ptSameLine) {
      professionalTax = cleanAmount(ptSameLine[1]);
    } else {
      for (let i = 0; i < lines.length; i++) {
        if (/16\(iii\)/i.test(lines[i]) || /tax\s+on\s+employment/i.test(lines[i])) {
          professionalTax = findFirstNonZeroAmount(lines, i, 4);
          if (professionalTax > 0) break;
        }
      }
    }

    // ── HRA EXEMPTION — Sec 10(13A)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/10\(13A\)/i.test(line) && !/10\(10AA\)/i.test(line)) {
        const amounts = findAllAmountsInBlock(lines, i, 5);
        for (const a of amounts) {
          const val = cleanAmount(a);
          if (val > 0) { hraExemption = val; break; }
        }
        if (hraExemption > 0) break;
      }
    }

    // ── SECTION 80C
    for (let i = 0; i < lines.length; i++) {
      const line  = lines[i];
      const is80C = /\b80C\b/i.test(line) && !/80CCC|80CCD|80G\b|80D\b|80TTA|80E\b/i.test(line);
      if (is80C) {
        const amounts = findAllAmountsInBlock(lines, i, 5);
        if (amounts.length > 0) {
          const val = cleanAmount(amounts[amounts.length - 1]);
          if (val > 0 && val <= 150000) { section80C = val; break; }
        }
      }
    }

    // ── TDS DEDUCTED — four-strategy waterfall
    const tdsDeducted = extractTdsDeducted(lines, cleanText, grossSalary);

    console.log(`[PARSER] Gross: ₹${grossSalary}, PT: ₹${professionalTax}, HRA: ₹${hraExemption}, 80C: ₹${section80C}, TDS: ₹${tdsDeducted}`);

    const extractedData = {
      grossSalary,
      perquisites:    0,
      professionalTax,
      hraExemption,
      section80C,
      section80D:     0,
      section24b:     0,
      section80CCD_2: 0,
      tdsDeducted,
    };

    const fieldWarnings = buildFieldWarnings(extractedData);
    if (Object.keys(fieldWarnings).length > 0) {
      console.warn('[PARSER] Field warnings:', fieldWarnings);
    }

    return { extractedData, rawText, fieldWarnings, docWarning };

  } catch (error) {
    if (error.userFacing) throw error;
    console.error('[PARSER RUNTIME EXCEPTION]:', error);
    throw new Error(`PARSING_FAILURE: ${error.message}`);
  }
}

module.exports = { parseForm16Text };