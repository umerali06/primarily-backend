const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const alertController = require("../controllers/alert.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");

// Validation rules
const createAlertValidation = [
  body("itemId")
    .notEmpty()
    .withMessage("Item ID is required")
    .isMongoId()
    .withMessage("Invalid item ID"),
  body("type")
    .optional()
    .isIn(["low_quantity", "expiration", "custom"])
    .withMessage("Invalid alert type"),
  body("threshold")
    .optional()
    .isNumeric()
    .withMessage("Threshold must be a number"),
  body("message")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Message cannot be more than 500 characters"),
];

const updateStatusValidation = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["read", "resolved"])
    .withMessage('Status must be either "read" or "resolved"'),
];

// Routes
router.get("/", protect, alertController.getAlerts);
router.get("/count", protect, alertController.getAlertCount);
router.post(
  "/",
  protect,
  createAlertValidation,
  validate,
  alertController.createAlert
);
router.get("/:id", protect, alertController.getAlertById);
router.put(
  "/:id/status",
  protect,
  updateStatusValidation,
  validate,
  alertController.updateAlertStatus
);
router.delete("/:id", protect, alertController.deleteAlert);
router.put("/mark-all-read", protect, alertController.markAllAsRead);

module.exports = router;
