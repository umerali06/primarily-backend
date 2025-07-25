const express = require("express");
const router = express.Router();
const {
  getSettings,
  updateSettings,
  updateProfile,
  updatePreferences,
  updateNotifications,
  updatePrivacy,
  updateSecurity,
  updateIntegrations,
  changePassword,
  resetSettings,
} = require("../controllers/settings.controller");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { body } = require("express-validator");

// Validation rules
const updateProfileValidation = [
  body("displayName")
    .optional()
    .isLength({ min: 1 })
    .withMessage("Display name cannot be empty"),
  body("timezone").optional().isString().withMessage("Invalid timezone"),
  body("language").optional().isString().withMessage("Invalid language"),
  body("dateFormat").optional().isString().withMessage("Invalid date format"),
  body("timeFormat").optional().isString().withMessage("Invalid time format"),
];

const updatePreferencesValidation = [
  body("defaultView")
    .optional()
    .isIn(["grid", "list", "table"])
    .withMessage("Invalid default view"),
  body("itemsPerPage")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Items per page must be between 1 and 100"),
  body("theme")
    .optional()
    .isIn(["light", "dark", "auto"])
    .withMessage("Invalid theme"),
  body("defaultSortBy").optional().isString().withMessage("Invalid sort field"),
  body("defaultSortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Invalid sort order"),
];

const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
];

// Routes
router.get("/", protect, getSettings);
router.put("/", protect, updateSettings); // Unified settings update
router.put(
  "/profile",
  protect,
  updateProfileValidation,
  validate,
  updateProfile
);
router.put(
  "/preferences",
  protect,
  updatePreferencesValidation,
  validate,
  updatePreferences
);
router.put("/notifications", protect, updateNotifications);
router.put("/privacy", protect, updatePrivacy);
router.put("/security", protect, updateSecurity);
router.put("/integrations", protect, updateIntegrations);
router.put(
  "/password",
  protect,
  changePasswordValidation,
  validate,
  changePassword
);
router.post("/reset", protect, resetSettings);

module.exports = router;
