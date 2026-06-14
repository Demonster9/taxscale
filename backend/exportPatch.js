/**
 * FRONTEND PATCH — replace exportPDFSummary in App.jsx
 *
 * 1. Remove the old exportPDFSummary function entirely.
 * 2. Paste this one in its place (same location, before the `return`).
 * 3. No other changes needed in App.jsx.
 */

const exportPDFSummary = async () => {
  if (!analysis || !metrics) return;
  setExporting(true);

  try {
    const res = await fetch('http://localhost:5000/api/export-pdf', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName:        'Taxpayer',          // replace with real name if you add a name field
        pan:             '****1234',          // replace with masked PAN from extractedData
        assessmentYear:  '2025-26',
        metrics,                             // simulatedData from state
        newRegime:       analysis.newRegime,
        oldRegime:       analysis.oldRegime,
        regimeSuggested: isNewOptimal ? 'new' : 'old',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    // Stream the PDF blob into a download
    const blob     = await res.blob();
    const url      = URL.createObjectURL(blob);
    const anchor   = document.createElement('a');
    anchor.href    = url;
    anchor.download = `TaxGenie_Report_AY2025-26.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error('[exportPDF]', err);
    // Optional: surface the error to the user via setError()
    // setError('PDF export failed: ' + err.message);
  } finally {
    setExporting(false);
  }
};