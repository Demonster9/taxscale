// backend/utils/taxEngine.js

function calculateTaxes(extractedData, assessmentYear = "2026-27") {
    const grossSalary = Number(extractedData.grossSalary || 0);
    const perquisites = Number(extractedData.perquisites || 0);
    const grossIncome = grossSalary + perquisites;

    const professionalTax = Number(extractedData.professionalTax || 0);
    const hraExemption = Number(extractedData.hraExemption || 0);
    const section80C = Math.min(Number(extractedData.section80C || 0), 150000);
    const section80D = Number(extractedData.section80D || 0);
    const section24b = Math.min(Number(extractedData.section24b || 0), 200000);

    // ─── OLD REGIME MATH ───
    const oldStandardDeduction = 50000;
    const totalOldDeductions = oldStandardDeduction + professionalTax + hraExemption + section80C + section80D + section24b;
    const oldTaxablePool = Math.max(0, grossIncome - totalOldDeductions);

    let oldBaseTax = 0;
    if (oldTaxablePool > 1000000) oldBaseTax = (oldTaxablePool - 1000000) * 0.30 + 112500;
    else if (oldTaxablePool > 500000) oldBaseTax = (oldTaxablePool - 500000) * 0.20 + 12500;
    else if (oldTaxablePool > 250000) oldBaseTax = (oldTaxablePool - 250000) * 0.05;
    if (oldTaxablePool <= 500000) oldBaseTax = 0; // 87A Rebate

    // 🚀 OLD REGIME SURCHARGE
    let oldSurcharge = 0;
    if (oldTaxablePool > 50000000) oldSurcharge = oldBaseTax * 0.37;
    else if (oldTaxablePool > 20000000) oldSurcharge = oldBaseTax * 0.25;
    else if (oldTaxablePool > 10000000) oldSurcharge = oldBaseTax * 0.15;
    else if (oldTaxablePool > 5000000) oldSurcharge = oldBaseTax * 0.10;

    const oldCess = (oldBaseTax + oldSurcharge) * 0.04;
    const oldTotalTax = oldBaseTax + oldSurcharge + oldCess;

    // ─── NEW REGIME MATH ───
    const newStandardDeduction = 75000;
    const newTaxablePool = Math.max(0, grossIncome - newStandardDeduction);

    let newBaseTax = 0;
    if (newTaxablePool > 2000000) newBaseTax = (newTaxablePool - 2000000) * 0.30 + 200000;
    else if (newTaxablePool > 1600000) newBaseTax = (newTaxablePool - 1600000) * 0.20 + 120000;
    else if (newTaxablePool > 1200000) newBaseTax = (newTaxablePool - 1200000) * 0.15 + 60000;
    else if (newTaxablePool > 800000) newBaseTax = (newTaxablePool - 800000) * 0.10 + 20000;
    else if (newTaxablePool > 400000) newBaseTax = (newTaxablePool - 400000) * 0.05;
    if (newTaxablePool <= 700000) newBaseTax = 0; // 87A Rebate

    // 🚀 NEW REGIME SURCHARGE
    let newSurcharge = 0;
    if (newTaxablePool > 20000000) newSurcharge = newBaseTax * 0.25;
    else if (newTaxablePool > 10000000) newSurcharge = newBaseTax * 0.15;
    else if (newTaxablePool > 5000000) newSurcharge = newBaseTax * 0.10;

    const newCess = (newBaseTax + newSurcharge) * 0.04;
    const newTotalTax = newBaseTax + newSurcharge + newCess;

    return {
        oldRegime: {
            taxablePool: oldTaxablePool,
            baseTax: Math.round(oldBaseTax),
            surcharge: Math.round(oldSurcharge),
            cess: Math.round(oldCess),
            totalTax: Math.round(oldTotalTax)
        },
        newRegime: {
            taxablePool: newTaxablePool,
            baseTax: Math.round(newBaseTax),
            surcharge: Math.round(newSurcharge),
            cess: Math.round(newCess),
            totalTax: Math.round(newTotalTax)
        }
    };
}

module.exports = { calculateTaxes };