import React, { useState, useEffect } from 'react';
import { Upload, ShieldCheck, ArrowRight, Activity, AlertCircle, Info, ChevronDown, ChevronUp, Sliders, RefreshCw, Lock } from 'lucide-react';

// 🚀 FIXED: Dynamic API URL for production and local HTTPS testing
const BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//localhost:5000`;

// ── Session-only history helpers (sessionStorage) ──────────────────
const SESSION_HISTORY_KEY = 'tg_session_history';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

function loadSessionHistory() {
    try {
        const raw = sessionStorage.getItem(SESSION_HISTORY_KEY);
        if (!raw) return [];
        const all = JSON.parse(raw);
        return all.filter(r => (r.uploadedAt || '').slice(0, 10) === TODAY_ISO);
    } catch {
        return [];
    }
}

function addSessionHistoryEntry(entry) {
    try {
        const existing = loadSessionHistory();
        const updated = [entry, ...existing].slice(0, 50);
        sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(updated));
    } catch {}
}

export default function Dashboard() {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [taxData, setTaxData] = useState(null);
    const [activeLedgerTab, setActiveLedgerTab] = useState('NEW');
    const [showDetailedLedger, setShowDetailedLedger] = useState(false);
    const [sessionHistory, setSessionHistory] = useState(() => loadSessionHistory());
    const [selectedReport, setSelectedReport] = useState(null);

    const [sim80C, setSim80C] = useState(0);
    const [sim80D, setSim80D] = useState(0);
    const [sim24b, setSim24b] = useState(0);
    const [isSimulating, setIsSimulating] = useState(false);

    const activeDisplayData = taxData || selectedReport;

    useEffect(() => {
        if (activeDisplayData?.extractedData) {
            const extracted80C = activeDisplayData.extractedData.section80C || activeDisplayData.extractedData['80C'] || 0;
            const extracted80D = activeDisplayData.extractedData.section80D || activeDisplayData.extractedData['80D'] || 0;
            const extracted24b = activeDisplayData.extractedData.section24b || activeDisplayData.extractedData['24b'] || 0;
            setSim80C(Math.min(Number(extracted80C), 150000));
            setSim80D(Number(extracted80D));
            setSim24b(Number(extracted24b));
            setIsSimulating(false);
        }
    }, [activeDisplayData]);

    useEffect(() => {
        if (selectedReport) setTaxData(null);
    }, [selectedReport]);

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        setStatus('uploading');
        setErrorMessage('');
        setSelectedReport(null);
        const formData = new FormData();
        formData.append('form16', selectedFile);
        try {
            // 🚀 FIXED: Now uses the dynamic BASE_URL
            const response = await fetch(`${BASE_URL}/api/parse-form16`, {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (response.ok && (result.success || result.extractedData)) {
                setTaxData(result);
                setStatus('success');
                const entry = {
                    fileName: selectedFile.name,
                    uploadedAt: new Date().toISOString(),
                    extractedData: result.extractedData,
                    analysis: result.analysis || {},
                };
                addSessionHistoryEntry(entry);
                setSessionHistory(loadSessionHistory());
            } else {
                setErrorMessage(result.error || 'Failed to extract document metrics.');
                setStatus('error');
            }
        } catch (err) {
            setErrorMessage('Cannot establish link with TaxScale secure backend gateway.');
            setStatus('error');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // CORE TAX MATH ENGINE
    // ─────────────────────────────────────────────────────────────────────────
    const getLedgerMetrics = () => {
        if (!activeDisplayData?.extractedData) return null;

        const data = activeDisplayData.extractedData;

        const grossSalary   = Number(data.grossSalary || data.Gross || 0);
        const perquisites   = Number(data.perquisites || 0);
        const grossTrackedIncome = grossSalary + perquisites;

        const professionalTax  = Number(data.professionalTax || data.PT || 0);
        const hraExemption     = Number(data.hraExemption || data.HRA || 0);
        const section80CCD_2   = Number(data.section80CCD_2 || 0);

        const newStandardDeduction = 75000;
        const oldStandardDeduction = 50000;

        const newTaxablePool = Math.max(0, grossTrackedIncome - newStandardDeduction - section80CCD_2);

        // ── Slab Taxes ───────────────────────
        const computeNewRegimeTaxMath = (income) => {
            if (income <= 700000) return 0;
            let tax = 0;
            if (income > 400000)  tax += Math.min(income - 400000,  400000) * 0.05;
            if (income > 800000)  tax += Math.min(income - 800000,  400000) * 0.10;
            if (income > 1200000) tax += Math.min(income - 1200000, 400000) * 0.15;
            if (income > 1600000) tax += Math.min(income - 1600000, 400000) * 0.20;
            if (income > 2000000) tax += (income - 2000000) * 0.30;  
            return tax;
        };

        const computeOldRegimeTaxMath = (income) => {
            if (income <= 500000) return 0;
            let tax = 0;
            if (income > 250000)  tax += Math.min(income - 250000,  250000) * 0.05;
            if (income > 500000)  tax += Math.min(income - 500000,  500000) * 0.20;
            if (income > 1000000) tax += (income - 1000000) * 0.30;
            return tax;
        };

        // ── 🚀 SURCHARGE CALCULATOR (This fixes the missing ₹20 Lakh) ───────────
        const computeSurchargeMath = (taxableIncome, baseTax, isNewRegime = true) => {
            if (taxableIncome <= 5000000) return 0;
            if (taxableIncome > 5000000 && taxableIncome <= 10000000) return baseTax * 0.10;
            if (taxableIncome > 10000000 && taxableIncome <= 20000000) return baseTax * 0.15;
            if (taxableIncome > 20000000 && taxableIncome <= 50000000) return baseTax * 0.25;
            if (taxableIncome > 50000000) return isNewRegime ? baseTax * 0.25 : baseTax * 0.37;
            return 0;
        };

        const active80C = isSimulating ? sim80C : Math.min(Number(data.section80C || data['80C'] || 0), 150000);
        const active80D = isSimulating ? sim80D : Number(data.section80D || data['80D'] || 0);
        const active24b = isSimulating ? sim24b : Number(data.section24b || data['24b'] || 0);

        const totalOldDeductions = oldStandardDeduction + professionalTax + hraExemption + active80C + active80D + active24b;
        const oldTaxablePool = Math.max(0, grossTrackedIncome - totalOldDeductions);

        // ── 🚀 FORCE NATIVE FRONTEND MATH (Prevents server override) ───────────
        const newBaseTax = computeNewRegimeTaxMath(newTaxablePool);
        const oldBaseTax = computeOldRegimeTaxMath(oldTaxablePool);

        // Calculate Surcharges for high income earners
        const newSurcharge = computeSurchargeMath(newTaxablePool, newBaseTax, true);
        const oldSurcharge = computeSurchargeMath(oldTaxablePool, oldBaseTax, false);

        // Cess is calculated on the combined total of (Base Tax + Surcharge)
        const newCess = (newBaseTax + newSurcharge) * 0.04;
        const oldCess = (oldBaseTax + oldSurcharge) * 0.04;

        // Final tax totals
        const newRegimeTax = Math.round(newBaseTax + newSurcharge + newCess);
        const oldRegimeTax = Math.round(oldBaseTax + oldSurcharge + oldCess);

        const generateSlabsNew = (income) => {
            const slabs = [
                { range: "₹0 - ₹4,00,000",        rate: "0%",  tax: 0 },
                { range: "₹4,00,001 - ₹8,00,000",  rate: "5%",  tax: 0 },
                { range: "₹8,00,001 - ₹12,00,000", rate: "10%", tax: 0 },
                { range: "₹12,00,001 - ₹16,00,000",rate: "15%", tax: 0 },
                { range: "₹16,00,001 - ₹20,00,000",rate: "20%", tax: 0 },
                { range: "Above ₹20,00,000",        rate: "30%", tax: 0 },
            ];
            if (income <= 700000) return slabs;
            slabs[1].tax = Math.min(400000, Math.max(0, income - 400000))  * 0.05;
            slabs[2].tax = Math.min(400000, Math.max(0, income - 800000))  * 0.10;
            slabs[3].tax = Math.min(400000, Math.max(0, income - 1200000)) * 0.15;
            slabs[4].tax = Math.min(400000, Math.max(0, income - 1600000)) * 0.20;
            slabs[5].tax = Math.max(0, income - 2000000) * 0.30;
            return slabs;
        };

        const generateSlabsOld = (income) => {
            const slabs = [
                { range: "₹0 - ₹2,50,000",          rate: "0%",  tax: 0 },
                { range: "₹2,50,001 - ₹5,00,000",   rate: "5%",  tax: 0 },
                { range: "₹5,00,001 - ₹10,00,000",  rate: "20%", tax: 0 },
                { range: "Above ₹10,00,000",         rate: "30%", tax: 0 },
            ];
            if (income <= 500000) return slabs;
            slabs[1].tax = Math.min(250000, Math.max(0, income - 250000))  * 0.05;
            slabs[2].tax = Math.min(500000, Math.max(0, income - 500000))  * 0.20;
            slabs[3].tax = Math.max(0, income - 1000000) * 0.30;
            return slabs;
        };

        return {
            grossTrackedIncome,
            professionalTax,
            hraExemption,
            section80C:    active80C,
            section80D:    active80D,
            section24b:    active24b,
            oldRegimeTax,
            newRegimeTax,
            oldStandardDeduction,
            oldTaxablePool,
            newStandardDeduction,
            newTaxablePool,
            oldBaseTax:    Math.round(oldBaseTax),
            oldSurcharge:  Math.round(oldSurcharge),
            oldCess:       Math.round(oldCess),
            newBaseTax:    Math.round(newBaseTax),
            newSurcharge:  Math.round(newSurcharge),
            newCess:       Math.round(newCess),
            newSlabBreakdown: generateSlabsNew(newTaxablePool),
            oldSlabBreakdown: generateSlabsOld(oldTaxablePool),
        };
    };

    const metrics = getLedgerMetrics();

    let finalRecommendedRegime = "NEW";
    let calculatedSavings = 0;

    if (metrics) {
        if (metrics.oldRegimeTax < metrics.newRegimeTax) {
            finalRecommendedRegime = "OLD";
            calculatedSavings = metrics.newRegimeTax - metrics.oldRegimeTax;
        } else {
            finalRecommendedRegime = "NEW";
            calculatedSavings = metrics.oldRegimeTax - metrics.newRegimeTax;
        }
    }

    const slidersDisabled = finalRecommendedRegime === 'NEW';
    const SLIDER_DISABLED_TITLE = 'These deductions are not applicable under the New Tax Regime.';

    const resetSimulation = () => {
        if (activeDisplayData?.extractedData) {
            const data = activeDisplayData.extractedData;
            setSim80C(Math.min(Number(data.section80C || data['80C'] || 0), 150000));
            setSim80D(Number(data.section80D || data['80D'] || 0));
            setSim24b(Number(data.section24b || data['24b'] || 0));
            setIsSimulating(false);
        }
    };

    const formatDate = (iso) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };


    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-xl text-white">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900">TaxScale V2</h1>
                            <p className="text-xs text-slate-500 font-medium">Automated Optimization Engine</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full font-semibold">
                        <Activity size={14} /> Pipeline Gateway Live (Port 5000)
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="lg:w-2/3 w-full flex flex-col gap-8">

                        {/* Upload Wrapper Block */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                            <h2 className="text-lg font-bold text-slate-900 mb-2">Upload Form 16 Document</h2>
                            <p className="text-sm text-slate-500 mb-6">Drop your official TRACES Form 16 PDF ledger sheet.</p>

                            <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors duration-200 ${
                                status === 'uploading' ? 'border-indigo-400 bg-indigo-50/30' :
                                status === 'success'   ? 'border-emerald-400 bg-emerald-50/20' :
                                status === 'error'     ? 'border-rose-400 bg-rose-50/20' :
                                'border-slate-300 hover:border-indigo-500 hover:bg-slate-50'
                            }`}>
                                <input type="file" name="form16" accept=".pdf" className="hidden" onChange={handleFileChange} disabled={status === 'uploading'} />

                                {status === 'idle' && (
                                    <>
                                        <Upload className="text-indigo-600 mb-3" size={36} />
                                        <span className="font-semibold text-sm text-slate-700">Click to locate or drag PDF template here</span>
                                    </>
                                )}
                                {status === 'uploading' && (
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                                        <span className="font-semibold text-sm text-indigo-700">Executing Architecture Miner...</span>
                                    </div>
                                )}
                                {status === 'success' && (
                                    <>
                                        <ShieldCheck className="text-emerald-600 mb-2" size={36} />
                                        <span className="font-semibold text-sm text-emerald-800">Mining Completed Successfully</span>
                                    </>
                                )}
                                {status === 'error' && (
                                    <>
                                        <AlertCircle className="text-rose-600 mb-2" size={36} />
                                        <span className="font-semibold text-sm text-rose-800">Error Occurred</span>
                                        <span className="text-xs text-rose-600 mt-1">{errorMessage}</span>
                                    </>
                                )}
                            </label>

                            <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <Lock size={13} className="text-emerald-600 flex-shrink-0" />
                                <span className="text-xs text-emerald-700 font-medium leading-snug">
                                    🔒 Your data is processed in-memory and never stored. Your privacy is our priority.
                                </span>
                            </div>
                        </div>

                        {metrics && (
                            <div className="flex flex-col gap-8">
                                {/* Summary Recommendation Ribbon */}
                                <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs uppercase tracking-wider bg-indigo-500/30 border border-indigo-400/30 px-3 py-1 rounded-full font-bold">Advisory</span>
                                            {isSimulating && <span className="text-xs uppercase tracking-wider bg-amber-500/30 border border-amber-400/30 px-3 py-1 rounded-full font-bold text-amber-300">Simulation Active</span>}
                                        </div>
                                        <h3 className="text-2xl font-black mt-3">File under the {finalRecommendedRegime === "OLD" ? "OLD REGIME" : "NEW REGIME"}</h3>
                                    </div>
                                    <div className="bg-white/10 border border-white/10 rounded-xl px-6 py-4 text-center min-w-[200px]">
                                        <span className="text-xs text-indigo-200 font-bold block uppercase">Net Annual Savings</span>
                                        <span className="text-3xl font-black text-emerald-400 block mt-1">₹{calculatedSavings.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                {/* Comparison Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                                    {/* Old Regime card */}
                                    <div className={`bg-white rounded-2xl p-6 shadow-sm border ${finalRecommendedRegime === 'OLD' ? 'border-2 border-indigo-500' : 'border-slate-200'}`}>
                                        <h3 className="text-sm font-bold pb-2 border-b">Old Tax Regime</h3>
                                        <div className="space-y-3 mt-4 text-sm">
                                            <div className="flex justify-between"><span>Gross Tracked Income</span><span className="font-semibold">₹{metrics.grossTrackedIncome.toLocaleString('en-IN')}</span></div>
                                            <div className="flex justify-between text-rose-600">
                                                <span>Standard Deduction</span>
                                                <span>-₹{metrics.oldStandardDeduction.toLocaleString('en-IN')}</span>
                                            </div>
                                            {/* 🚀 Dynamic High-Income Surcharge row added directly to Old Regime Summary Box Card */}
                                            {metrics.oldSurcharge > 0 && (
                                                <div className="flex justify-between text-amber-600 font-semibold">
                                                    <span>(+) High Surcharge</span>
                                                    <span>₹{metrics.oldSurcharge.toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between border-t pt-3 font-bold text-base"><span>Net Tax</span><span>₹{metrics.oldRegimeTax.toLocaleString('en-IN')}</span></div>
                                        </div>
                                        <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg border-l-4 border-l-amber-500">
                                            <p className="text-xs text-amber-800 leading-relaxed">
                                                <strong>⚠️ Important:</strong> The Old Regime tax calculation relies on claiming
                                                deductions (HRA, 80C, etc.). Please ensure you have valid receipts and investment
                                                proofs to back these claims during tax filing. Failure to provide documentation
                                                can result in penalties.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center text-slate-400 py-2">
                                        <ArrowRight className="hidden md:block" size={20} />
                                        <span className="text-xs font-bold uppercase tracking-widest mt-1">VS</span>
                                    </div>

                                    {/* New Regime card */}
                                    <div className={`bg-white rounded-2xl p-6 shadow-sm border ${finalRecommendedRegime === 'NEW' ? 'border-2 border-indigo-500' : 'border-slate-200'}`}>
                                        <h3 className="text-sm font-bold pb-2 border-b">New Tax Regime</h3>
                                        <div className="space-y-3 mt-4 text-sm">
                                            <div className="flex justify-between"><span>Gross Tracked Income</span><span className="font-semibold">₹{metrics.grossTrackedIncome.toLocaleString('en-IN')}</span></div>
                                            <div className="flex justify-between text-rose-600"><span>Enhanced Standard Ded.</span><span>-₹{metrics.newStandardDeduction.toLocaleString('en-IN')}</span></div>
                                            {/* 🚀 Dynamic High-Income Surcharge row added directly to New Regime Summary Box Card */}
                                            {metrics.newSurcharge > 0 && (
                                                <div className="flex justify-between text-amber-600 font-semibold">
                                                    <span>(+) High Surcharge</span>
                                                    <span>₹{metrics.newSurcharge.toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between border-t pt-3 font-bold text-base text-indigo-600"><span>Net Tax</span><span>₹{metrics.newRegimeTax.toLocaleString('en-IN')}</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Simulation Controls */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                    <div className="flex justify-between border-b pb-3 mb-4 items-center">
                                        <div className="flex items-center gap-2">
                                            <Sliders size={18} className="text-indigo-600" />
                                            <h3 className="text-sm font-bold text-slate-900">"What-If" Deduction Simulator</h3>
                                        </div>
                                        {isSimulating && !slidersDisabled && (
                                            <button onClick={resetSimulation} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded font-semibold flex items-center gap-1">
                                                <RefreshCw size={10} /> Reset
                                            </button>
                                        )}
                                    </div>

                                    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${slidersDisabled ? 'pointer-events-none opacity-50' : ''}`}>
                                        <div className="space-y-2" title={slidersDisabled ? SLIDER_DISABLED_TITLE : ''}>
                                            <div className="flex justify-between text-xs font-bold"><span>Sec 80C Investments</span><span className="text-indigo-600">₹{sim80C.toLocaleString('en-IN')}</span></div>
                                            <input
                                                type="range" min="0" max="150000" step="5000" value={sim80C}
                                                onChange={(e) => { if (!slidersDisabled) { setSim80C(Number(e.target.value)); setIsSimulating(true); } }}
                                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                disabled={slidersDisabled}
                                            />
                                        </div>
                                        <div className="space-y-2" title={slidersDisabled ? SLIDER_DISABLED_TITLE : ''}>
                                            <div className="flex justify-between text-xs font-bold"><span>Sec 80D Health Med</span><span className="text-indigo-600">₹{sim80D.toLocaleString('en-IN')}</span></div>
                                            <input
                                                type="range" min="0" max="100000" step="2500" value={sim80D}
                                                onChange={(e) => { if (!slidersDisabled) { setSim80D(Number(e.target.value)); setIsSimulating(true); } }}
                                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                disabled={slidersDisabled}
                                            />
                                        </div>
                                        <div className="space-y-2" title={slidersDisabled ? SLIDER_DISABLED_TITLE : ''}>
                                            <div className="flex justify-between text-xs font-bold"><span>Sec 24(b) Home Loan Interest</span><span className="text-indigo-600">₹{sim24b.toLocaleString('en-IN')}</span></div>
                                            <input
                                                type="range" min="0" max="200000" step="5000" value={sim24b}
                                                onChange={(e) => { if (!slidersDisabled) { setSim24b(Number(e.target.value)); setIsSimulating(true); } }}
                                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                disabled={slidersDisabled}
                                            />
                                        </div>
                                    </div>

                                    {slidersDisabled && (
                                        <p className="mt-3 text-xs text-slate-400 italic flex items-center gap-1">
                                            <Info size={11} /> These deductions are not applicable under the New Tax Regime.
                                        </p>
                                    )}
                                </div>

                                {/* Toggle Button */}
                                <div className="flex justify-center">
                                    <button onClick={() => setShowDetailedLedger(!showDetailedLedger)} className="flex items-center gap-2 px-4 py-2 bg-white border text-xs font-bold rounded-xl shadow-sm hover:bg-slate-50">
                                        {showDetailedLedger ? "Hide Calculations" : "View Detailed Ledger"}
                                        {showDetailedLedger ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                </div>

                                {/* Expandable Calculation Ledger */}
                                {showDetailedLedger && (
                                    <div className="bg-white rounded-2xl border p-6 space-y-4">
                                        <div className="flex bg-slate-100 p-1 rounded-lg w-fit gap-1 text-xs font-bold">
                                            <button onClick={() => setActiveLedgerTab('NEW')} className={`px-3 py-1.5 rounded ${activeLedgerTab === 'NEW' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>New Regime Track</button>
                                            <button onClick={() => setActiveLedgerTab('OLD')} className={`px-3 py-1.5 rounded ${activeLedgerTab === 'OLD' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'}`}>Old Regime Track</button>
                                        </div>

                                        {activeLedgerTab === 'NEW' ? (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border text-sm">
                                                    <div>
                                                        <span className="text-xs font-bold text-indigo-600 block mb-2">Stage 1: Base Formulation</span>
                                                        <div className="flex justify-between mb-1"><span>Gross</span><span>₹{metrics.grossTrackedIncome.toLocaleString('en-IN')}</span></div>
                                                        <div className="flex justify-between text-rose-600 mb-1"><span>(-) Standard Ded.</span><span>-₹{metrics.newStandardDeduction.toLocaleString('en-IN')}</span></div>
                                                        <div className="flex justify-between font-bold border-t pt-2"><span>Taxable Pool</span><span>₹{metrics.newTaxablePool.toLocaleString('en-IN')}</span></div>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-indigo-600 block mb-2">Stage 2: Slab Allocation</span>
                                                        <div className="flex justify-between mb-1"><span>Base Tax</span><span>₹{metrics.newBaseTax.toLocaleString('en-IN')}</span></div>
                                                        {metrics.newSurcharge > 0 && (
                                                            <div className="flex justify-between mb-1 text-amber-600 font-medium"><span>(+) Surcharge</span><span>₹{metrics.newSurcharge.toLocaleString('en-IN')}</span></div>
                                                        )}
                                                        <div className="flex justify-between mb-1"><span>(+) Cess (4%)</span><span>₹{metrics.newCess.toLocaleString('en-IN')}</span></div>
                                                        <div className="flex justify-between font-bold text-indigo-600 border-t pt-2 text-base"><span>Total Tax</span><span>₹{metrics.newRegimeTax.toLocaleString('en-IN')}</span></div>
                                                    </div>
                                                </div>
                                                <table className="w-full text-left text-xs border">
                                                    <thead className="bg-slate-50 border-b"><tr><th className="p-2">Slab Thresholds</th><th className="p-2">Rate</th><th className="p-2 text-right">Computed Tax</th></tr></thead>
                                                    <tbody className="divide-y">{metrics.newSlabBreakdown.map((s, i) => (<tr key={i} className={s.tax > 0 ? "bg-indigo-50/30" : ""}><td className="p-2">{s.range}</td><td className="p-2">{s.rate}</td><td className="p-2 text-right">₹{Math.round(s.tax).toLocaleString('en-IN')}</td></tr>))}</tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border text-sm">
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-600 block mb-2">Stage 1: Base Formulation</span>
                                                        <div className="flex justify-between mb-1"><span>Gross</span><span>₹{metrics.grossTrackedIncome.toLocaleString('en-IN')}</span></div>
                                                        <div className="flex justify-between text-rose-600 mb-1"><span>(-) Deductions Applied</span><span>-₹{(metrics.oldStandardDeduction + metrics.professionalTax + metrics.hraExemption + metrics.section80C + metrics.section80D + metrics.section24b).toLocaleString('en-IN')}</span></div>
                                                        <div className="flex justify-between font-bold border-t pt-2"><span>Taxable Pool</span><span>₹{metrics.oldTaxablePool.toLocaleString('en-IN')}</span></div>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-600 block mb-2">Stage 2: Slab Allocation</span>
                                                        <div className="flex justify-between mb-1"><span>Base Tax</span><span>₹{metrics.oldBaseTax.toLocaleString('en-IN')}</span></div>
                                                        {metrics.oldSurcharge > 0 && (
                                                            <div className="flex justify-between mb-1 text-amber-600 font-medium"><span>(+) Surcharge</span><span>₹{metrics.oldSurcharge.toLocaleString('en-IN')}</span></div>
                                                        )}
                                                        <div className="flex justify-between mb-1"><span>(+) Cess (4%)</span><span>₹{metrics.oldCess.toLocaleString('en-IN')}</span></div>
                                                        <div className="flex justify-between font-bold border-t pt-2 text-base"><span>Total Tax</span><span>₹{metrics.oldRegimeTax.toLocaleString('en-IN')}</span></div>
                                                    </div>
                                                </div>
                                                <table className="w-full text-left text-xs border">
                                                    <thead className="bg-slate-50 border-b"><tr><th className="p-2">Slab Thresholds</th><th className="p-2">Rate</th><th className="p-2 text-right">Computed Tax</th></tr></thead>
                                                    <tbody className="divide-y">{metrics.oldSlabBreakdown.map((s, i) => (<tr key={i} className={s.tax > 0 ? "bg-slate-50" : ""}><td className="p-2">{s.range}</td><td className="p-2">{s.rate}</td><td className="p-2 text-right">₹{Math.round(s.tax).toLocaleString('en-IN')}</td></tr>))}</tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Session History panel */}
                    <div className="lg:w-1/3 w-full">
                        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <div className="border-b border-slate-100 pb-4 mb-6 flex items-start gap-3">
                                <div className="bg-slate-100 p-2 rounded-xl text-slate-700 mt-0.5">
                                    <Info size={18} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Session History</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Form 16 analyses from your current session.</p>
                                </div>
                            </div>

                            {sessionHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                    <Info size={32} />
                                    <p className="mt-3 text-sm font-medium text-center">No analyses yet this session. Upload a Form 16 to get started.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {sessionHistory.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedReport(item)}
                                            className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
                                                selectedReport === item
                                                    ? 'border-indigo-400 bg-indigo-50'
                                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="font-semibold text-indigo-700 truncate">{item.fileName}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{formatDate(item.uploadedAt)}</div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <p className="mt-5 text-xs text-slate-400 leading-relaxed border-t border-slate-100 pt-4">
                                This history is saved locally in your browser for this session only and is wiped when you close this window.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}