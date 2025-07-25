const express = require("express");
const { body, param, query } = require("express-validator");
const router = express.Router();
const itemController = require("../controllers/item.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const { uploadSingle, uploadMultiple } = require("../middleware/upload");
const {
  checkPermission,
  checkBulkPermission,
  addAccessibleResources,
} = require("../middleware/permission");

// Validation rules
const createItemValidation = [
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
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Notes cannot be more than 2000 characters"),
  body("quantity")
    .optional()
    .isNumeric()
    .withMessage("Quantity must be a number")
    .isFloat({ min: 0 })
    .withMessage("Quantity cannot be negative"),
  body("unit").optional().trim(),
  body("minLevel")
    .optional()
    .isNumeric()
    .withMessage("Minimum level must be a number")
    .isFloat({ min: 0 })
    .withMessage("Minimum level cannot be negative"),
  body("price")
    .optional()
    .isNumeric()
    .withMessage("Price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Price cannot be negative"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("folderId")
    .optional()
    .custom((value) => {
      if (value === null || value === "null" || value === "") return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage("Invalid folder ID"),
];

const updateItemValidation = [
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
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Notes cannot be more than 2000 characters"),
  body("quantity")
    .optional()
    .isNumeric()
    .withMessage("Quantity must be a number")
    .isFloat({ min: 0 })
    .withMessage("Quantity cannot be negative"),
  body("unit").optional().trim(),
  body("minLevel")
    .optional()
    .isNumeric()
    .withMessage("Minimum level must be a number")
    .isFloat({ min: 0 })
    .withMessage("Minimum level cannot be negative"),
  body("price")
    .optional()
    .isNumeric()
    .withMessage("Price must be a number")
    .isFloat({ min: 0 })
    .withMessage("Price cannot be negative"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("folderId")
    .optional()
    .custom((value) => {
      if (value === null || value === "null" || value === "") return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage("Invalid folder ID"),
];

const updateQuantityValidation = [
  body("change")
    .notEmpty()
    .withMessage("Quantity change is required")
    .isNumeric()
    .withMessage("Quantity change must be a number"),
  body("reason").optional().trim(),
];

const moveItemValidation = [
  body("folderId")
    .notEmpty()
    .withMessage("Folder ID is required")
    .custom((value) => {
      if (value === null || value === "null") return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage("Invalid folder ID"),
];

const bulkUpdateValidation = [
  body("itemIds")
    .isArray()
    .withMessage("Item IDs must be an array")
    .notEmpty()
    .withMessage("Item IDs are required"),
  body("updates").isObject().withMessage("Updates must be an object"),
];

// Routes
router.post(
  "/",
  protect,
  uploadMultiple("images", 8), // Allow up to 8 images
  createItemValidation,
  validate,
  itemController.createItem
);
router.get(
  "/",
  protect,
  addAccessibleResources("item", "view"),
  itemController.getItems
);
router.get(
  "/search",
  protect,
  addAccessibleResources("item", "view"),
  itemController.searchItems
);
router.get("/stats", protect, itemController.getItemStats);

// Bulk operations (must come before :id routes)
router.put("/bulk", protect, itemController.bulkUpdateItems);
router.delete(
  "/bulk",
  protect,
  checkBulkPermission("item", "admin"),
  itemController.bulkDeleteItems
);

router.get(
  "/:id",
  protect,
  checkPermission("item", "view"),
  itemController.getItemById
);
router.put(
  "/:id",
  protect,
  uploadMultiple("images", 8), // Allow up to 8 images
  checkPermission("item", "edit"),
  updateItemValidation,
  validate,
  itemController.updateItem
);
router.delete(
  "/:id",
  protect,
  checkPermission("item", "admin"),
  itemController.deleteItem
);
router.put(
  "/:id/quantity",
  protect,
  checkPermission("item", "edit"),
  updateQuantityValidation,
  validate,
  itemController.updateQuantity
);
router.post(
  "/:id/images",
  protect,
  checkPermission("item", "edit"),
  uploadSingle("image"),
  itemController.addItemImage
);
router.post(
  "/:id/images/multiple",
  protect,
  checkPermission("item", "edit"),
  uploadMultiple("images", 5),
  itemController.addMultipleImages
);
router.delete(
  "/:id/images/:imageIndex",
  protect,
  checkPermission("item", "edit"),
  itemController.removeItemImage
);
router.put(
  "/:id/move",
  protect,
  checkPermission("item", "edit"),
  moveItemValidation,
  validate,
  itemController.moveItem
);

// Get item activities
router.get(
  "/:id/activities",
  protect,
  checkPermission("item", "view"),
  itemController.getItemActivities
);

module.exports = router;
// Barcode routes
router.get("/barcode/:barcode", protect, itemController.findItemByBarcode);
router.get("/search/barcode", protect, itemController.searchItemsByBarcode);
router.post("/:id/barcode", protect, itemController.generateItemBarcode);
router.patch("/:id/barcode", protect, itemController.updateItemBarcode);
router.get(
  "/:id/barcode/history",
  protect,
  itemController.getItemBarcodeHistory
);
