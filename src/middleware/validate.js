const { validationResult } = require("express-validator");
const { ValidationError } = require("../utils/customError");

/**
 * Middleware to validate request data using express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Log detailed validation errors for debugging
    console.log("🔍 Validation errors:", {
      url: req.url,
      method: req.method,
      body: req.body,
      errors: errors.array(),
    });

    // Format errors
    const formattedErrors = {};
    errors.array().forEach((error) => {
      formattedErrors[error.path] = error.msg;
    });

    // Throw validation error
    return next(new ValidationError("Validation failed", formattedErrors));
  }

  next();
};

module.exports = validate;
