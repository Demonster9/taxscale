// ─────────────────────────────────────────────────────────────────────────────
// utils/optimizerEngine.js  —  TaxGenie
//
// CHANGES vs previous version:
//   1. Reads tdsDeducted from extractedData — computes refundDue / additionalTaxDue
//   2. Adds 87A rebate disclosure note (not applicable here but always stated)
//   3. Adds surcharge disclosure note (nil for income < 50L)
//   4. Regime recommendation description now says "Expected ITR refund" not "savings"
//      when TDS has already been deducted at source
//   5. All other logic (80C, HRA, PT, high-income advisory) is UNCHANGED
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

/**
 * generateRecommendations
 * @param {object} extractedData  Raw values parsed from Form 16
 * @param {object} analysis       Output of calculateTaxes()
 * @returns {Array<object>}       Ordered recommendation objects
 */
function generateRecommendations(extractedData, analysis) {

  if (!extractedData || !analysis) {
    console.warn('[OptimizerEngine] Missing input — returning empty recommendations');
    return [];
  }

  const recommendations = [];

  // ── Read extractedData fields ─────────────────────────────────────────────
  const current80C      = Number(extractedData.section80C      || 0);
  const professionalTax = Number(extractedData.professionalTax || 0);
  const hraExemption    = Number(extractedData.hraExemption    || 0);
  const grossSalary     = Number(extractedData.grossSalary     || 0);
  // TDS already deposited by employer
  const tdsDeducted     = Number(extractedData.tdsDeducted     || 0);

  // ── Read analysis using the CORRECT property paths ────────────────────────
  const newTax          = Number(analysis.newRegime?.totalTax || 0);
  const oldTax          = Number(analysis.oldRegime?.totalTax || 0);

  const isNewOptimal      = newTax < oldTax;
  const recommendedRegime = isNewOptimal ? 'NEW' : 'OLD';
  const recommendedTax    = isNewOptimal ? newTax : oldTax;
  const potentialSavings  = Math.abs(newTax - oldTax);

  // ── TDS reconciliation ─────────────────────────────────────────────────────
  // Employer deducts TDS during the year (usually on old regime basis).
  // When taxpayer files ITR under the recommended regime, the delta is settled.
  const tdsReconciliationDiff = tdsDeducted - recommendedTax;
  const refundDue             = tdsReconciliationDiff > 0  ? tdsReconciliationDiff  : 0;
  const additionalTaxDue      = tdsReconciliationDiff < 0  ? Math.abs(tdsReconciliationDiff) : 0;

  // ── AY mismatch advisory ──────────────────────────────────────────────────
  if (analysis.ayMismatch && analysis.ayMismatchWarning) {
    recommendations.push({
      category:    'Data Notice',
      priority:    'High',
      title:       `Form 16 AY Mismatch: ${analysis.form16AY} vs ${analysis.assessmentYear}`,
      description: analysis.ayMismatchWarning,
    });
  }

  // ── Rebate u/s 87A disclosure ─────────────────────────────────────────────
  // AY 2026-27: rebate available up to ₹60,000 if taxable income ≤ ₹12,00,000 (New) / ₹5,00,000 (Old)
  const newTaxableIncome   = Number(analysis.newRegime?.taxablePool || 0);
  const oldTaxableIncome   = Number(analysis.oldRegime?.taxablePool || 0);
  const rebateThresholdNew = 1200000;  // ₹12L — AY 2026-27 New Regime
  const rebateThresholdOld = 500000;   // ₹5L  — Old Regime (unchanged)
  const applicable87ANew   = newTaxableIncome <= rebateThresholdNew;
  const applicable87AOld   = oldTaxableIncome <= rebateThresholdOld;

  recommendations.push({
    category:    'Rebate u/s 87A',
    priority:    'Medium',
    title:       'Section 87A Rebate Status',
    description: applicable87ANew
      ? `Your taxable income under the New Regime (₹${newTaxableIncome.toLocaleString('en-IN')}) is ` +
        `within the ₹12,00,000 threshold — a full rebate u/s 87A applies, making your tax liability Nil.`
      : `Section 87A rebate is not applicable. Your taxable income under the New Regime ` +
        `(₹${newTaxableIncome.toLocaleString('en-IN')}) exceeds the ₹12,00,000 threshold for AY 2026-27.`,
  });

  // ── Surcharge disclosure ──────────────────────────────────────────────────
  // Surcharge applies only if total income > ₹50,00,000
  const surchargeThreshold = 5000000;
  if (grossSalary > surchargeThreshold) {
    // 🚀 FIX: Read the exact computed surcharge amount dynamically from the analysis object block
    const activeSurcharge = isNewOptimal 
      ? Number(analysis.newRegime?.surcharge || 0) 
      : Number(analysis.oldRegime?.surcharge || 0);

    let surchargeRate = 0;
    if      (grossSalary <= 10000000)  surchargeRate = 0.10;
    else if (grossSalary <= 20000000)  surchargeRate = 0.15;
    else if (grossSalary <= 50000000)  surchargeRate = 0.25;
    else                               surchargeRate = 0.37;

    recommendations.push({
      category:    'Surcharge',
      priority:    'High',
      title:       'Surcharge Applicable on Your Income',
      description: `Your gross income exceeds ₹50L. A surcharge of ${surchargeRate * 100}% has been applied to your base tax liability, amounting to an explicit charge of ₹${activeSurcharge.toLocaleString('en-IN')}.`,
    });
  } else {
    recommendations.push({
      category:    'Surcharge',
      priority:    'Low',
      title:       'Surcharge: Not Applicable',
      description: `Your income (₹${grossSalary.toLocaleString('en-IN')}) is below the ₹50,00,000 ` +
                   `surcharge threshold. No surcharge is payable for AY 2026-27.`,
    });
  }

  // ── Section 80C ───────────────────────────────────────────────────────────
  if (current80C < 150000) {
    const remaining = 150000 - current80C;
    recommendations.push({
      category:    'Section 80C',
      priority:    'High',
      title:       'Maximise Section 80C Investments',
      description: `You can invest ₹${remaining.toLocaleString('en-IN')} more under Section 80C ` +
                   `through ELSS, PPF, EPF, LIC, or a Tax Saver FD to reduce your old-regime taxable income.`,
    });
  }

  // ── HRA ───────────────────────────────────────────────────────────────────
  if (hraExemption === 0) {
    recommendations.push({
      category:    'HRA',
      priority:    'Medium',
      title:       'Review HRA Exemption Eligibility',
      description: 'If you live in rented accommodation, you may be eligible to claim an HRA exemption ' +
                   'under the old regime. Submit rent receipts and your landlord\'s PAN to your employer.',
    });
  }

  // ── Professional Tax ──────────────────────────────────────────────────────
  if (professionalTax === 0) {
    recommendations.push({
      category:    'Professional Tax',
      priority:    'Low',
      title:       'Verify Professional Tax Deduction',
      description: 'Professional Tax paid to your state government is deductible under the old regime. ' +
                   'Confirm with your employer whether it has been included in your Form 16.',
    });
  }

  // ── Regime recommendation ─────────────────────────────────────────────────
  // If TDS was already deducted, the "savings" is actually a refund on ITR filing.
  // We now distinguish between the two cases clearly.
  if (tdsDeducted > 0 && refundDue > 0) {
    // Employer over-deducted TDS vs recommended regime tax → refund on ITR
    recommendations.push({
      category:    'Tax Regime',
      priority:    'High',
      title:       `File under ${recommendedRegime} Tax Regime — Expect ITR Refund`,
      description: `Filing under the ${recommendedRegime} Regime results in a tax liability of ` +
                   `₹${recommendedTax.toLocaleString('en-IN')}. Your employer already deducted TDS of ` +
                   `₹${tdsDeducted.toLocaleString('en-IN')} — you are entitled to a refund of ` +
                   `₹${refundDue.toLocaleString('en-IN')} when you file your ITR. ` +
                   `This is not additional savings — it is excess TDS already paid on your behalf.`,
    });
  } else if (tdsDeducted > 0 && additionalTaxDue > 0) {
    // Under-deducted TDS → balance payable on ITR
    recommendations.push({
      category:    'Tax Regime',
      priority:    'High',
      title:       `File under ${recommendedRegime} Tax Regime — Balance Tax Payable`,
      description: `Filing under the ${recommendedRegime} Regime results in a tax liability of ` +
                   `₹${recommendedTax.toLocaleString('en-IN')}. Your employer deducted TDS of ` +
                   `₹${tdsDeducted.toLocaleString('en-IN')} — a balance of ` +
                   `₹${additionalTaxDue.toLocaleString('en-IN')} is payable when you file your ITR.`,
    });
  } else {
    // No TDS data available — fall back to generic savings language
    recommendations.push({
      category:    'Tax Regime',
      priority:    'High',
      title:       `Recommended Regime: ${recommendedRegime} Tax Regime`,
      description: isNewOptimal
        ? `The New Tax Regime results in a lower tax of ₹${newTax.toLocaleString('en-IN')} ` +
          `vs ₹${oldTax.toLocaleString('en-IN')} under the Old Regime ` +
          `(difference: ₹${potentialSavings.toLocaleString('en-IN')}).`
        : `The Old Tax Regime results in a lower tax of ₹${oldTax.toLocaleString('en-IN')} ` +
          `vs ₹${newTax.toLocaleString('en-IN')} under the New Regime ` +
          `(difference: ₹${potentialSavings.toLocaleString('en-IN')}).`,
    });
  }

  // ── High income advisory ──────────────────────────────────────────────────
  if (grossSalary > 1500000) {
    recommendations.push({
      category:    'Tax Planning',
      priority:    'Medium',
      title:       'Explore Additional Tax-Saving Opportunities',
      description: 'At this income level, consider NPS contributions (80CCD(1B) — up to ₹50,000 extra), ' +
                   'employer NPS under 80CCD(2), home loan interest deductions (Sec 24), and ' +
                   'health insurance premiums under 80D to further optimise your tax outgo.',
    });
  }

  // ── Attach reconciliation metadata for use by report builder ─────────────
  // The controller/report builder can read recommendations._meta to populate
  // the TaxReport analysis fields without re-computing.
  recommendations._meta = {
    tdsDeducted,
    refundDue,
    additionalTaxDue,
    recommendedRegime,
    potentialSavings,
    rebate87AApplicable: applicable87ANew,
    surchargeApplicable: grossSalary > surchargeThreshold,
  };

  return recommendations;
}

module.exports = { generateRecommendations };