const express = require("express");
const router = express.Router();
const {
  getInventorySummary,
  getTransactions,
  getActivityHistory,
  getItemFlow,
  getMoveSummary,
  getUserActivitySummary,
  exportReport,
} = require("../controllers/report.controller");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { body, query } = require("express-validator");

// Validation rules
const dateRangeValidation = [
  query("startDate").optional().isISO8601().withMessage("Invalid start date"),
  query("endDate").optional().isISO8601().withMessage("Invalid end date"),
];

const exportValidation = [
  body("reportType")
    .isIn(["inventory-summary", "transactions", "activity-history"])
    .withMessage("Invalid report type"),
  body("format")
    .isIn(["csv", "xlsx", "pdf", "json"])
    .withMessage("Invalid export format"),
];

// Routes
router.get("/inventory-summary", protect, getInventorySummary);
router.get(
  "/transactions",
  protect,
  dateRangeValidation,
  validate,
  getTransactions
);
router.get(
  "/activity-history",
  protect,
  dateRangeValidation,
  validate,
  getActivityHistory
);
router.get("/item-flow", protect, getItemFlow);
router.get("/move-summary", protect, getMoveSummary);
router.get("/user-activity-summary", protect, getUserActivitySummary);
router.post("/export", protect, exportValidation, validate, exportReport);

module.exports = router;
