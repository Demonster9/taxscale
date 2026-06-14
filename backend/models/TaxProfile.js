const mongoose = require('mongoose');

/**
 * Audit History Sub-schema
 * Tracks the lifecycle of Form 16 uploads and parsing attempts.
 */
const AuditHistorySchema = new mongoose.Schema({
  parsedTimestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  fileHash: {
    type: String,
    required: true,
    description: 'SHA-256 or MD5 hash to prevent duplicate file uploads'
  },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSED', 'FAILED'],
    default: 'PENDING',
    required: true
  }
}, { _id: false }); // Disable _id for sub-documents to save space in history arrays

/**
 * Tax Profile Schema
 * Primary collection for automated tax platform metrics and deductions.
 */
const TaxProfileSchema = new mongoose.Schema({
  // 1. User Identification
  userUniqueId: {
    type: String,
    required: true,
    unique: true, // As requested; consider compound index if multiple years per user are needed
    trim: true,
    index: true
  },
  encryptedPAN: {
    type: String,
    required: true,
    trim: true
  },

  // 2. Financial Assessment Year
  assessmentYear: {
    type: String,
    required: true,
    trim: true,
    match: /^\d{4}-\d{2}$/, // Validation for "2026-27" format
    index: true
  },

  // 3. Parsed Form 16 Metrics
  grossSalary: {
    type: Number,
    default: 0,
    min: 0
  },
  perquisites: {
    type: Number,
    default: 0,
    min: 0
  },
  profitsInLieu: {
    type: Number,
    default: 0,
    min: 0
  },
  professionalTax: {
    type: Number,
    default: 0,
    min: 0
  },

  // 4. Extracted Deductions
  section80C: {
    type: Number,
    default: 0,
    min: 0
  },
  section80D: {
    type: Number,
    default: 0,
    min: 0
  },
  section80CCD_2: {
    type: Number,
    default: 0,
    min: 0
  },

  // 5. Audit History tracking
  auditHistory: [AuditHistorySchema]

}, {
  // Automatic Mongoose timestamps (createdAt, updatedAt)
  timestamps: true,
  collection: 'TaxProfiles'
});

/**
 * Performance & Integrity Indexing
 */

// Index the fileHash inside the array for duplicate detection across the platform
TaxProfileSchema.index({ 'auditHistory.fileHash': 1 });

// ARCHITECT NOTE: If the business logic allows one user to have multiple years, 
// uncomment the line below and remove 'unique: true' from userUniqueId.
// TaxProfileSchema.index({ userUniqueId: 1, assessmentYear: 1 }, { unique: true });

const TaxProfile = mongoose.model('TaxProfile', TaxProfileSchema);

module.exports = TaxProfile;
