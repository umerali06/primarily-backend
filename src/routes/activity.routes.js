const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const activityController = require("../controllers/activity.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");

// Validation rules
const createActivityValidation = [
  body("resourceId")
    .notEmpty()
    .withMessage("Resource ID is required")
    .isMongoId()
    .withMessage("Invalid resource ID"),
  body("resourceType")
    .notEmpty()
    .withMessage("Resource type is required")
    .isIn(["item", "folder", "user", "alert"])
    .withMessage("Invalid resource type"),
  body("action")
    .notEmpty()
    .withMessage("Action is required")
    .isIn([
      "create",
      "update",
      "delete",
      "move",
      "quantity_change",
      "status_change",
      "login",
      "logout",
      "custom",
    ])
    .withMessage("Invalid action"),
  body("details")
    .optional()
    .isObject()
    .withMessage("Details must be an object"),
];

// Routes
router.get("/", protect, activityController.getActivities);
router.get("/summary", protect, activityController.getActivitySummary);
router.get("/items/:itemId", protect, activityController.getItemActivities);
router.get(
  "/folders/:folderId",
  protect,
  activityController.getFolderActivities
);
router.post(
  "/",
  protect,
  createActivityValidation,
  validate,
  activityController.createActivity
);

module.exports = router;
