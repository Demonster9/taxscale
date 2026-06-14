// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/config/taxSlabs.js
//
// ⚠️  MIRROR CHANGE: when you update slabs here, also update
//     backend/config/taxSlabs.js with the same values.
//
// ┌─ HOW TO UPDATE EACH YEAR ──────────────────────────────────────────────────
// │  1. Copy the latest year block and change the key  (e.g. "2027-28")
// │  2. Update standardDeduction, rebateLimit, cess, and slabs
// │  3. Change CURRENT_AY to the new key  ← only other line to touch
// └────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const TAX_RULES = {

  // ── AY 2025-26  (kept for historical audit re-calculation) ────────────────
  "2025-26": {
    oldRegime: {
      standardDeduction: 50000,
      rebateLimit: 500000,    // Sec 87A — zero tax if taxable income ≤ this
      cess: 0.04,
      slabs: [
        { limit: 250000,   rate: 0    },
        { limit: 500000,   rate: 0.05 },
        { limit: 1000000,  rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ],
    },
    newRegime: {
      standardDeduction: 75000,
      rebateLimit: 700000,
      cess: 0.04,
      slabs: [
        { limit: 300000,   rate: 0    },
        { limit: 600000,   rate: 0.05 },
        { limit: 900000,   rate: 0.10 },
        { limit: 1200000,  rate: 0.15 },
        { limit: 1500000,  rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ],
    },
  },

  // ── AY 2026-27  (Union Budget 2025 — effective FY 2025-26) ────────────────
  "2026-27": {
    oldRegime: {
      standardDeduction: 50000,
      rebateLimit: 500000,
      cess: 0.04,
      slabs: [
        { limit: 250000,   rate: 0    },
        { limit: 500000,   rate: 0.05 },
        { limit: 1000000,  rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ],
    },
    newRegime: {
      standardDeduction: 75000,
      rebateLimit: 1200000,   // Budget 2025: zero tax up to ₹12 lakh
      cess: 0.04,
      slabs: [
        { limit: 400000,   rate: 0    },
        { limit: 800000,   rate: 0.05 },
        { limit: 1200000,  rate: 0.10 },
        { limit: 1600000,  rate: 0.15 },
        { limit: 2000000,  rate: 0.20 },
        // 🚀 FIXED: The 25% slab has been removed. Income above ₹20L is taxed directly at 30%.
        { limit: Infinity, rate: 0.30 },
      ],
    },
  },

  // ── AY 2027-28 TEMPLATE — uncomment and fill after next Budget ────────────
  // "2027-28": {
  //   oldRegime: {
  //     standardDeduction: 50000,
  //     rebateLimit: 500000,
  //     cess: 0.04,
  //     slabs: [ /* copy from above, edit as needed */ ],
  //   },
  //   newRegime: {
  //     standardDeduction: 75000,
  //     rebateLimit: ...,
  //     cess: 0.04,
  //     slabs: [ /* new slabs from Budget speech */ ],
  //   },
  // },
};

// ── Change ONLY this line when a new AY becomes active ────────────────────────
export const CURRENT_AY = "2026-27";