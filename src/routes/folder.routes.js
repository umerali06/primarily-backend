const express = require("express");
const { body, param, query } = require("express-validator");
const router = express.Router();
const folderController = require("../controllers/folder.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const {
  checkPermission,
  addAccessibleResources,
} = require("../middleware/permission");

// Validation rules
const createFolderValidation = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .trim()
    .isLength({ max: 100 })
    .withMessage("Name cannot be more than 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot be more than 1000 characters"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot be more than 1000 characters"),
  body("parentId")
    .optional()
    .custom((value) => {
      if (value === null || value === "null") return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage("Invalid parent folder ID"),
];

const updateFolderValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Name cannot be more than 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot be more than 1000 characters"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot be more than 1000 characters"),
  body("parentId")
    .optional()
    .custom((value) => {
      if (value === null || value === "null") return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage("Invalid parent folder ID"),
];

// Routes
router.post(
  "/",
  protect,
  createFolderValidation,
  validate,
  folderController.createFolder
);

router.get(
  "/",
  protect,
  addAccessibleResources("folder", "view"),
  folderController.getFolders
);

router.get("/hierarchy", protect, folderController.getFolderHierarchy);

router.get(
  "/:id",
  protect,
  checkPermission("folder", "view"),
  folderController.getFolderById
);

router.put(
  "/:id",
  protect,
  checkPermission("folder", "edit"),
  updateFolderValidation,
  validate,
  folderController.updateFolder
);

router.post(
  "/:id/clone",
  protect,
  checkPermission("folder", "edit"),
  [
    body("name")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Name cannot be more than 100 characters"),
    body("includeItems")
      .optional()
      .isBoolean()
      .withMessage("Include items must be a boolean"),
  ],
  validate,
  folderController.cloneFolder
);

router.delete(
  "/:id",
  protect,
  checkPermission("folder", "admin"),
  folderController.deleteFolder
);

router.put(
  "/:id/move",
  protect,
  checkPermission("folder", "edit"),
  [
    body("parentId")
      .optional()
      .custom((value) => {
        if (value === null || value === "null") return true;
        return /^[0-9a-fA-F]{24}$/.test(value);
      })
      .withMessage("Invalid parent folder ID"),
  ],
  validate,
  folderController.moveFolder
);

router.get(
  "/:id/items",
  protect,
  checkPermission("folder", "view"),
  folderController.getFolderItems
);

router.get(
  "/:id/activities",
  protect,
  checkPermission("folder", "view"),
  folderController.getFolderActivities
);

// Folder permissions routes
router.get(
  "/:id/permissions",
  protect,
  checkPermission("folder", "view"),
  folderController.getFolderPermissions
);

router.put(
  "/:id/permissions",
  protect,
  checkPermission("folder", "admin"),
  [
    body("permissions").isArray().withMessage("Permissions must be an array"),
    body("permissions.*.userEmail")
      .isEmail()
      .withMessage("Valid email is required for each permission"),
    body("permissions.*.role")
      .isIn(["owner", "editor", "viewer"])
      .withMessage("Role must be owner, editor, or viewer"),
  ],
  validate,
  folderController.setFolderPermissions
);

// Folder alerts routes
router.get(
  "/:id/alerts",
  protect,
  checkPermission("folder", "view"),
  folderController.getFolderAlerts
);

router.post(
  "/:id/alerts",
  protect,
  checkPermission("folder", "edit"),
  [
    body("name")
      .notEmpty()
      .withMessage("Alert name is required")
      .trim()
      .isLength({ max: 100 })
      .withMessage("Alert name cannot be more than 100 characters"),
    body("type")
      .isIn(["low_stock", "high_value", "item_added", "item_removed"])
      .withMessage("Invalid alert type"),
    body("recipients")
      .isArray({ min: 1 })
      .withMessage("At least one recipient is required"),
    body("recipients.*")
      .isEmail()
      .withMessage("All recipients must be valid email addresses"),
    body("notificationMethods")
      .isArray({ min: 1 })
      .withMessage("At least one notification method is required"),
    body("notificationMethods.*")
      .isIn(["email", "sms"])
      .withMessage("Invalid notification method"),
    body("enabled")
      .optional()
      .isBoolean()
      .withMessage("Enabled must be a boolean"),
  ],
  validate,
  folderController.setFolderAlert
);

router.put(
  "/:id/alerts/:alertId",
  protect,
  checkPermission("folder", "edit"),
  [
    body("name")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Alert name cannot be more than 100 characters"),
    body("type")
      .optional()
      .isIn(["low_stock", "high_value", "item_added", "item_removed"])
      .withMessage("Invalid alert type"),
    body("recipients")
      .optional()
      .isArray({ min: 1 })
      .withMessage("At least one recipient is required"),
    body("recipients.*")
      .optional()
      .isEmail()
      .withMessage("All recipients must be valid email addresses"),
    body("notificationMethods")
      .optional()
      .isArray({ min: 1 })
      .withMessage("At least one notification method is required"),
    body("notificationMethods.*")
      .optional()
      .isIn(["email", "sms"])
      .withMessage("Invalid notification method"),
    body("enabled")
      .optional()
      .isBoolean()
      .withMessage("Enabled must be a boolean"),
  ],
  validate,
  folderController.updateFolderAlert
);

router.delete(
  "/:id/alerts/:alertId",
  protect,
  checkPermission("folder", "edit"),
  folderController.deleteFolderAlert
);

// Folder export routes
router.post(
  "/:id/export",
  protect,
  checkPermission("folder", "view"),
  [
    body("format")
      .optional()
      .isIn(["csv", "excel", "pdf", "json"])
      .withMessage("Invalid export format"),
    body("options")
      .optional()
      .isObject()
      .withMessage("Options must be an object"),
  ],
  validate,
  folderController.exportFolder
);

// Folder labels routes
router.get(
  "/:id/labels",
  protect,
  checkPermission("folder", "view"),
  folderController.getFolderLabels
);

router.post(
  "/:id/labels",
  protect,
  checkPermission("folder", "edit"),
  [
    body("name")
      .notEmpty()
      .withMessage("Label name is required")
      .trim()
      .isLength({ max: 50 })
      .withMessage("Label name cannot be more than 50 characters"),
    body("color")
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage("Color must be a valid hex color (e.g., #FF0000)"),
    body("icon")
      .optional()
      .isIn([
        "tag",
        "star",
        "heart",
        "flag",
        "bookmark",
        "diamond",
        "fire",
        "lightning",
        "crown",
        "trophy",
      ])
      .withMessage("Invalid icon"),
  ],
  validate,
  folderController.createFolderLabel
);

router.put(
  "/:id/labels/:labelId",
  protect,
  checkPermission("folder", "edit"),
  [
    body("name")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("Label name cannot be more than 50 characters"),
    body("color")
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage("Color must be a valid hex color (e.g., #FF0000)"),
    body("icon")
      .optional()
      .isIn([
        "tag",
        "star",
        "heart",
        "flag",
        "bookmark",
        "diamond",
        "fire",
        "lightning",
        "crown",
        "trophy",
      ])
      .withMessage("Invalid icon"),
  ],
  validate,
  folderController.updateFolderLabel
);

router.delete(
  "/:id/labels/:labelId",
  protect,
  checkPermission("folder", "edit"),
  folderController.deleteFolderLabel
);

module.exports = router;
