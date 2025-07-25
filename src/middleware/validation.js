const { body, validationResult } = require("express-validator");

// Tag validation
const validateTag = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Tag name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "Tag name can only contain letters, numbers, spaces, hyphens, and underscores"
    ),

  body("color")
    .optional()
    .isIn([
      "gray",
      "red",
      "blue",
      "green",
      "yellow",
      "purple",
      "pink",
      "orange",
    ])
    .withMessage("Invalid color value"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description cannot exceed 200 characters"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  },
];

module.exports = {
  validateTag,
};
