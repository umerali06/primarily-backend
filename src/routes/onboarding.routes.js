const express = require("express");
const router = express.Router();
const {
  getOnboardingStatus,
  completeOnboarding,
  updatePreferences,
  getPreferences,
  skipOnboarding,
} = require("../controllers/onboarding.controller");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { body } = require("express-validator");

// Validation rules
const completeOnboardingValidation = [
  body("businessType")
    .isIn(["small-business", "medium-business", "enterprise", "personal"])
    .withMessage("Invalid business type"),
  body("selectedCategories")
    .optional()
    .isArray()
    .withMessage("Selected categories must be an array"),
  body("selectedCategories.*")
    .optional()
    .isIn([
      "retail",
      "manufacturing",
      "healthcare",
      "education",
      "construction",
      "food-service",
      "automotive",
      "technology",
      "other",
    ])
    .withMessage("Invalid category"),
  body("teamSize")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Team size must be between 1 and 10000"),
  body("goals").optional().isArray().withMessage("Goals must be an array"),
  body("goals.*")
    .optional()
    .isIn([
      "track-inventory",
      "reduce-costs",
      "improve-efficiency",
      "compliance",
      "reporting",
      "automation",
    ])
    .withMessage("Invalid goal"),
  body("preferences.defaultView")
    .optional()
    .isIn(["grid", "list", "table"])
    .withMessage("Invalid default view"),
  body("preferences.theme")
    .optional()
    .isIn(["light", "dark", "auto"])
    .withMessage("Invalid theme"),
  body("preferences.notifications")
    .optional()
    .isBoolean()
    .withMessage("Notifications must be boolean"),
];

const updatePreferencesValidation = [
  body("preferences.defaultView")
    .optional()
    .isIn(["grid", "list", "table"])
    .withMessage("Invalid default view"),
  body("preferences.theme")
    .optional()
    .isIn(["light", "dark", "auto"])
    .withMessage("Invalid theme"),
  body("preferences.notifications")
    .optional()
    .isBoolean()
    .withMessage("Notifications must be boolean"),
  body("preferences.language")
    .optional()
    .isString()
    .withMessage("Language must be a string"),
  body("preferences.timezone")
    .optional()
    .isString()
    .withMessage("Timezone must be a string"),
];

// Routes
router.get("/status", protect, getOnboardingStatus);
router.post(
  "/complete",
  protect,
  completeOnboardingValidation,
  validate,
  completeOnboarding
);
router.post("/skip", protect, skipOnboarding);
router.get("/preferences", protect, getPreferences);
router.put(
  "/preferences",
  protect,
  updatePreferencesValidation,
  validate,
  updatePreferences
);

module.exports = router;
