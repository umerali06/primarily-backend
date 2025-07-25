const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const importController = require("../controllers/import.controller");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const multer = require("multer");
const path = require("path");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/temp/");
  },
  filename: (req, file, cb) => {
    cb(null, `import-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(csv|json)$/i;
    const extname = allowedExtensions.test(file.originalname.toLowerCase());

    // CSV files can have various MIME types depending on the browser/system
    const csvMimeTypes = [
      "text/csv",
      "application/csv",
      "text/comma-separated-values",
      "application/vnd.ms-excel",
      "text/plain",
    ];

    const jsonMimeTypes = ["application/json", "text/json"];

    const isValidMimeType =
      csvMimeTypes.includes(file.mimetype) ||
      jsonMimeTypes.includes(file.mimetype);

    if (
      extname &&
      (isValidMimeType ||
        file.originalname.toLowerCase().endsWith(".csv") ||
        file.originalname.toLowerCase().endsWith(".json"))
    ) {
      return cb(null, true);
    } else {
      console.log(
        `File rejected - Name: ${file.originalname}, MIME: ${file.mimetype}`
      );
      cb(new Error("Only CSV and JSON files are allowed"), false);
    }
  },
});

// Validation rules
const importValidation = [
  body("duplicateAction")
    .optional()
    .isIn(["skip", "update", "error"])
    .withMessage("Invalid duplicate action"),
];

const validateFileValidation = [
  body("type")
    .notEmpty()
    .withMessage("File type is required")
    .isIn(["csv", "json"])
    .withMessage("Invalid file type"),
];

// Import routes
router.get("/template", protect, importController.getImportTemplate);

router.post(
  "/items/csv",
  protect,
  upload.single("file"),
  importValidation,
  validate,
  importController.importItemsCSV
);

router.post(
  "/complete",
  protect,
  upload.single("file"),
  importValidation,
  validate,
  importController.importCompleteInventory
);

router.post(
  "/validate",
  protect,
  upload.single("file"),
  validateFileValidation,
  validate,
  importController.validateImportFile
);

module.exports = router;
