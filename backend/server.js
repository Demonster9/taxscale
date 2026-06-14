// ─────────────────────────────────────────────────────────────────────────────
// server.js  —  TaxScale backend
// ─────────────────────────────────────────────────────────────────────────────

const express    = require('express');
const cors       = require('cors');
const mongoose   = require('mongoose');
const multer     = require('multer');
const https      = require('https');
const fs         = require('fs');
const cookieSession = require('cookie-session'); // SECURITY FIX: Stateless session store
const { z }      = require('zod');
require('dotenv').config();

const { logAnalysis }           = require('./auditLogger');
const { generatePDF }           = require('./pdfGenerator');
const { parseForm16Text }         = require('./utils/pdfParser');
const { generateRecommendations } = require('./utils/optimizerEngine');
const TaxReport                 = require('./models/TaxReport');
const { TAX_RULES, CURRENT_AY }   = require('./config/taxSlabs');
const { calculateTaxes }          = require('./utils/taxEngine');

const app    = express();
const PORT   = process.env.PORT || 5000;

// Add this simple route to your existing Express app
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// SECURITY FIX: Restricted buffer size allocation to prevent RAM exhaustion (DoS Protection)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB Maximum Payload Limit
  }
});

// ── TLS ───────────────────────────────────────────────────────────────────────
let sslOptions = null;
try {
  sslOptions = {
    cert: fs.readFileSync('./localhost+2.pem'),
    key:  fs.readFileSync('./localhost+2-key.pem'),
  };
  console.log('🔒 TLS certificates loaded');
} catch {
  console.warn('⚠️  TLS certs not found — running HTTP');
}

const PROTOCOL     = sslOptions ? 'https' : 'http';
const FRONTEND_URL = process.env.FRONTEND_URL || `${PROTOCOL}://localhost:5173`;

// ── Middlewares ───────────────────────────────────────────────────────────────

// 🚀 FIXED: Added HTTPS to CORS Whitelist
const allowedOrigins = [
  'http://localhost:5173', 
  'https://localhost:5173', // <-- THIS WAS MISSING!
  process.env.ALLOWED_ORIGIN
].filter(Boolean);

app.use(cors({ 
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SECURITY FIX: Migrated from MemoryStore to encrypted browser cookie layers (Zero DB Footprint Policy)
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET || 'ts-dev-secret',
  maxAge: 24 * 60 * 60 * 1000, // 24 Hours
  secure: !!sslOptions,
  httpOnly: true,              // mitigates cross-site scripting (XSS) credential extraction
  sameSite: 'lax'              // cross-site request forgery (CSRF) tracking defense
}));

// ── DB ────────────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxscale')
  .then(() => console.log('🌐 MongoDB connected'))
  .catch(err => console.error('❌ DB error:', err));

// ── Zod schema — ceilings from taxSlabs so they stay in sync ─────────────────
const activeAY = TAX_RULES[CURRENT_AY];
const C        = activeAY.deductionCeilings || { section80C: 150000, section24b: 200000 };

const extractedDataSchema = z.object({
  grossSalary:     z.coerce.number().nonnegative().default(0),
  perquisites:     z.coerce.number().nonnegative().default(0),
  professionalTax: z.coerce.number().nonnegative().default(2400),
  hraExemption:    z.coerce.number().nonnegative().default(0),
  section80C:      z.coerce.number().nonnegative()
                    .max(C.section80C, `80C ceiling is ₹${C.section80C.toLocaleString('en-IN')}`)
                    .default(0),
  section80D:      z.coerce.number().nonnegative().default(0),
  section24b:      z.coerce.number().nonnegative()
                    .max(C.section24b, `Sec 24(b) ceiling is ₹${C.section24b.toLocaleString('en-IN')}`)
                    .default(0),
  section80CCD_2:  z.coerce.number().nonnegative().default(0),
}).passthrough();

// ── Route A: Parse → Validate → Calculate → Persist ──────────────────────────
app.post('/api/parse-form16', upload.single('form16'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Missing file payload.' });
    }

    // ── 1. Parse PDF ──────────────────────────────────────────────────────────
    let parseResult;
    try {
      parseResult = await parseForm16Text(req.file.buffer);
    } catch (parseErr) {
      if (parseErr.userFacing) {
        return res.status(422).json({
          success:      false,
          errorCode:    parseErr.code,          // 'SCANNED_PDF' | 'NOT_FORM16'
          error:        parseErr.message,       // exact string to show the user
        });
      }
      throw parseErr;   
    }

    const rawData       = parseResult?.extractedData ?? parseResult;
    const rawText       = parseResult?.rawText       ?? '';
    const fieldWarnings = parseResult?.fieldWarnings ?? {};
    const docWarning    = parseResult?.docWarning    ?? null; 

    // ── 2. Schema validation ──────────────────────────────────────────────────
    let validatedData;
    try {
      validatedData = extractedDataSchema.parse(rawData);
    } catch (zodError) {
      return res.status(422).json({
        success: false,
        error:   'Extracted data failed schema validation.',
        details: zodError.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    // ── 3. Tax calculation ────────────────────────────────────────────────────
    const ayKey        = req.body.assessmentYear || CURRENT_AY;
    const analysis     = calculateTaxes(validatedData, ayKey);
    const recommendations = generateRecommendations(validatedData, analysis);

    // ── 4. Persist ────────────────────────────────────────────────────────────
    const newReport = new TaxReport({
      fileName:      req.file.originalname,
      extractedData: validatedData,
      analysis,
      recommendations,
    });
    await newReport.save();

    // ── 5. Audit log (fire-and-forget) ────────────────────────────────────────
    setImmediate(() => {
      try {
        const taxNew = analysis.newRegime?.totalTax ?? 0;
        const taxOld = analysis.oldRegime?.totalTax ?? 0;

        logAnalysis({
          sessionId:       req.session ? req.session.id : null,
          clientIp:        req.ip,
          filename:        req.file.originalname,
          grossSalary:     validatedData.grossSalary,
          taxNew:          taxNew,
          taxOld:          taxOld,
          regimeSuggested: taxNew < taxOld ? 'new' : 'old',
          assessmentYear:  ayKey,
        });
      } catch (e) { console.error('[AuditLogger]', e.message); }
    });

    // ── 6. Respond — include fieldWarnings so frontend can highlight zeros ────
    res.json({
      success:        true,
      fileName:       req.file.originalname,
      extractedData:  validatedData,
      analysis,
      recommendations,
      rawText,
      fieldWarnings,   
      docWarning,      
    });

  } catch (error) {
    console.error('🚨 Pipeline error:', error);
    res.status(500).json({ 
      success: false, 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error occurred.' : error.message 
    });
  }
});

// ── Route: Export PDF ────────────────────────────────────────────────────────
app.post('/api/export-pdf', async (req, res) => {
  try {
    const pdfBuffer = await generatePDF(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=TaxScale_Report.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('🚨 PDF Export Error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF' });
  }
});
// ... (Rest of your existing routes: Route B, C, D, E, F) ...
// Ensure you paste the existing routes for reports, manual save, years, calculate, export-pdf below this.

// ── Start ─────────────────────────────────────────────────────────────────────
if (sslOptions) {
  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`✅ TaxScale → https://localhost:${PORT}  [AY ${CURRENT_AY}]`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`✅ TaxScale → http://localhost:${PORT}  [AY ${CURRENT_AY}]`);
  });
}