const { z } = require('zod');

// 1. Define the exact structural shape your calculator engine expects
const taxDataSchema = z.object({
  body: z.object({
    grossTrackedBaseline: z.number({
      required_error: "Gross baseline income is required",
      invalid_type_error: "Gross baseline must be a number"
    }).nonnegative("Gross baseline cannot be negative"),

    professionalTax: z.number().default(2400),
    hraExemption: z.number().nonnegative().default(0),
    section80C: z.number().max(150000, "80C deduction cannot exceed statutory cap of ₹1,50,000").default(0),
    section80D: z.number().max(25000, "Standard 80D health deduction cap exceeded").default(0),
    section24b: z.number().default(0)
  })
});

// 2. Efficient express middleware wrapper
const validateTaxInput = (req, res, next) => {
  try {
    // Parse throws an error automatically if structural shape is invalid
    const parsed = taxDataSchema.parse({ body: req.body });
    
    // Replace req.body with sanitized, parsed data (applies defaults cleanly)
    req.body = parsed.body;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation Error in Tax Input Stream",
        // Map fields directly to readable error responses
        errors: error.errors.map(err => ({
          field: err.path[1],
          message: err.message
        }))
      });
    }
    next(error);
  }
};

module.exports = { validateTaxInput };