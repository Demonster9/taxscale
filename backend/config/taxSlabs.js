// ─────────────────────────────────────────────────────────────────────────────
// backend/config/taxSlabs.js  —  CommonJS (Node.js)
//
// ⚠️  MIRROR CHANGE: when you update slabs here, also update
//     frontend/src/config/taxSlabs.js with the same values.
//
// ┌─ HOW TO UPDATE EACH YEAR ──────────────────────────────────────────────────
// │  1. Copy the latest year block and change the key  (e.g. "2027-28")
// │  2. Update standardDeduction, rebateLimit, rebateMaxBenefit,
// │     surchargeThreshold, cess, and slabs
// │  3. Change CURRENT_AY to the new key  ← only other line to touch
// └────────────────────────────────────────────────────────────────────────────

const TAX_RULES = {

  // ── AY 2025-26  (kept for historical audit re-calculation) ────────────────
  "2025-26": {
    oldRegime: {
      standardDeduction:  50000,
      rebateLimit:        500000,   // 87A: income must be ≤ this to get rebate
      rebateMaxBenefit:   12500,    // 87A: max rebate claimable
      surchargeThreshold: 5000000,  // surcharge kicks in above ₹50L
      cess:               0.04,
      slabs: [
        { limit: 250000,   rate: 0    },
        { limit: 500000,   rate: 0.05 },
        { limit: 1000000,  rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ],
    },
    newRegime: {
      standardDeduction:  75000,
      rebateLimit:        700000,   // 87A: income must be ≤ this to get rebate
      rebateMaxBenefit:   25000,    // 87A: max rebate claimable
      surchargeThreshold: 5000000,  // surcharge kicks in above ₹50L
      cess:               0.04,
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
      standardDeduction:  50000,
      rebateLimit:        500000,   // 87A: income must be ≤ this to get rebate
      rebateMaxBenefit:   12500,    // 87A: max rebate claimable
      surchargeThreshold: 5000000,  // surcharge kicks in above ₹50L
      cess:               0.04,
      slabs: [
        { limit: 250000,   rate: 0    },
        { limit: 500000,   rate: 0.05 },
        { limit: 1000000,  rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ],
    },
    newRegime: {
      standardDeduction:  75000,
      rebateLimit:        1200000,  // 87A: income must be ≤ this to get rebate (Budget 2025)
      rebateMaxBenefit:   60000,    // 87A: max rebate claimable (Budget 2025)
      surchargeThreshold: 5000000,  // surcharge kicks in above ₹50L
      cess:               0.04,
      slabs: [
        { limit: 400000,   rate: 0    },
        { limit: 800000,   rate: 0.05 },
        { limit: 1200000,  rate: 0.10 },
        { limit: 1600000,  rate: 0.15 },
        { limit: 2000000,  rate: 0.20 },
        // 🚀 The 25% slab has been removed. Income above ₹20L is taxed directly at 30%.
        { limit: Infinity, rate: 0.30 },
      ],
    },
  },
};

const CURRENT_AY = "2026-27";

// Strict CommonJS export for the backend
module.exports = { TAX_RULES, CURRENT_AY };