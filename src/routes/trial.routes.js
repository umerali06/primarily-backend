const express = require("express");
const router = express.Router();
const {
  startTrial,
  getTrialStatus,
  updateTrial,
  extendTrial,
  convertTrial,
  updateUsage,
  cancelTrial,
} = require("../controllers/trial.controller");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { body } = require("express-validator");

// Validation rules
const startTrialValidation = [
  body("trialDays")
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage("Trial days must be between 1 and 90"),
  body("billingInfo.email")
    .optional()
    .isEmail()
    .withMessage("Invalid email address"),
  body("billingInfo.phone")
    .optional()
    .isMobilePhone()
    .withMessage("Invalid phone number"),
  body("billingInfo.company")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Company name too long"),
];

const updateTrialValidation = [
  body("billingInfo.email")
    .optional()
    .isEmail()
    .withMessage("Invalid email address"),
  body("billingInfo.phone")
    .optional()
    .isMobilePhone()
    .withMessage("Invalid phone number"),
  body("billingInfo.company")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Company name too long"),
];

const extendTrialValidation = [
  body("days")
    .isInt({ min: 1, max: 30 })
    .withMessage("Extension days must be between 1 and 30"),
  body("reason")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Reason too long"),
];

const convertTrialValidation = [
  body("planSelected")
    .isIn(["basic", "professional", "enterprise"])
    .withMessage("Invalid plan selected"),
  body("conversionSource")
    .optional()
    .isIn(["trial", "upgrade-prompt", "feature-limit", "manual"])
    .withMessage("Invalid conversion source"),
];

const updateUsageValidation = [
  body("usageType")
    .isIn(["itemsCreated", "foldersCreated", "reportsGenerated"])
    .withMessage("Invalid usage type"),
  body("increment")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Increment must be a positive integer"),
];

// Routes
router.post("/start", protect, startTrialValidation, validate, startTrial);
router.get("/status", protect, getTrialStatus);
router.put("/update", protect, updateTrialValidation, validate, updateTrial);
router.put("/extend", protect, extendTrialValidation, validate, extendTrial);
router.post(
  "/convert",
  protect,
  convertTrialValidation,
  validate,
  convertTrial
);
router.put("/usage", protect, updateUsageValidation, validate, updateUsage);
router.put("/cancel", protect, cancelTrial);

module.exports = router;
