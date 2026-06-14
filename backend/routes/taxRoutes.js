const express = require('express');
const router = express.Router();
const multer = require('multer');
const TaxReport = require('../models/TaxReport');
const { parseForm16Text } = require('../utils/pdfParser'); 
const { calculateTaxes } = require('../utils/taxEngine'); // 🚀 Core data-driven calculation engine

// Setup memory storage for incoming file streams
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB Limit max
});

// Main Endpoint handler for parsing files
router.post('/parse-form16', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'document', maxCount: 1 }]), async (req, res) => {
    try {
        // Resolve target file from either upload key variant
        const targetFile = (req.files && req.files.file) ? req.files.file[0] : ((req.files && req.files.document) ? req.files.document[0] : null);

        if (!targetFile) {
            return res.status(400).json({ success: false, error: "No Form 16 file found in payload." });
        }

        // Run your regular expression text parser engine
        const parseResult = await parseForm16Text(targetFile.buffer);
        
        // Safe extraction fallback layer to support both server.js schema and legacy structures
        const rawData = parseResult?.extractedData ?? parseResult;
        const metrics = parseResult.data ? parseResult.data.metrics : rawData;
        const deductions = parseResult.data ? parseResult.data.deductions : rawData;

        const structuralExtraction = {
            grossSalary: Number(metrics.grossSalary || metrics.Gross || 0),
            perquisites: Number(metrics.perquisites || 0),
            professionalTax: Number(metrics.professionalTax || metrics.PT || 0),
            hraExemption: Number(parseResult.data?.hraExemption || metrics.hraExemption || metrics.HRA || 0),
            section80C: Number(deductions.section80C || deductions['80C'] || 0),
            section80D: Number(deductions.section80D || deductions['80D'] || 0), 
            section24b: Number(deductions.section24b || deductions['24b'] || 0),
            section80CCD_2: Number(deductions.section80CCD_2 || 0)
        };

        // Run unified tax calculations handling surcharges and data-driven slabs dynamically
        const analysis = calculateTaxes(structuralExtraction);

        // Commit metrics history data layout to your MongoDB Collection
        const savedReport = new TaxReport({
            fileName: targetFile.originalname,
            extractedData: structuralExtraction,
            analysis: analysis
        });
        await savedReport.save();

        // Return expected clean JSON state to React Frontend
        return res.json({
            success: true,
            fileName: targetFile.originalname,
            extractedData: structuralExtraction,
            analysis: analysis
        });

    } catch (error) {
        console.error("🚨 Router Controller Pipeline Failure:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint to fetch past execution analysis blocks
router.get('/reports', async (req, res) => {
    try {
        const history = await TaxReport.find().sort({ uploadedAt: -1 });
        return res.json({ success: true, history });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
const { generatePDF } = require('../pdfGenerator');

router.post('/export-pdf', async (req, res) => {
    try {
        const pdfBuffer = await generatePDF(req.body);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=TaxScale_Report.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate PDF' });
    }
});
module.exports = router;