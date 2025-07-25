const express = require("express");
const router = express.Router();
const exportController = require("../controllers/export.controller");
const { protect } = require("../middleware/auth");

// Export routes
router.get("/items/csv", protect, exportController.exportItemsCSV);
router.get("/items/json", protect, exportController.exportItemsJSON);
router.get("/folders/csv", protect, exportController.exportFoldersCSV);
router.get("/complete", protect, exportController.exportCompleteInventory);

module.exports = router;
