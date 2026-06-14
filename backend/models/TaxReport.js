const mongoose = require('mongoose');

const TaxReportSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    extractedData: {
        grossSalary:    { type: Number, default: 0 },
        perquisites:    { type: Number, default: 0 },
        professionalTax:{ type: Number, default: 0 },
        hraExemption:   { type: Number, default: 0 },
        section80C:     { type: Number, default: 0 },
        section80CCD_2: { type: Number, default: 0 },
        // ── NEW: TDS already deposited by employer (from Form 16 Part A total) ──
        tdsDeducted:    { type: Number, default: 0 },
    },
    analysis: {
        // ── FIXED: property names now match taxEngine.js output shape ──────────
        // Previously: oldRegimeTax / newRegimeTax  (caused silent undefined reads)
        // Now aligned with taxEngine's: oldRegime.totalTax / newRegime.totalTax
        oldRegimeTax:     { type: Number, default: 0 },
        newRegimeTax:     { type: Number, default: 0 },
        potentialSavings: { type: Number, default: 0 },
        recommendedRegime:{ type: String },

        // ── NEW: TDS reconciliation fields ──────────────────────────────────────
        tdsDeducted:      { type: Number, default: 0 },  // copied from extractedData
        refundDue:        { type: Number, default: 0 },  // tdsDeducted - recommendedRegimeTax (if > 0)
        additionalTaxDue: { type: Number, default: 0 },  // recommendedRegimeTax - tdsDeducted (if > 0)

        // ── NEW: Disclosure flags (fixes audit warnings 1 & 2) ─────────────────
        rebate87AApplicable: { type: Boolean, default: false },
        surchargeApplicable: { type: Boolean, default: false },
        surchargeAmount:     { type: Number,  default: 0 },
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TaxReport', TaxReportSchema);