const express = require("express");
const router = express.Router();
const {
  createContact,
  getContacts,
  updateContact,
  getContactById,
  deleteContact,
  getContactStats,
} = require("../controllers/contact.controller");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.post("/", createContact);

// Admin routes (require authentication and admin permissions)
router.get("/", protect, authorize("admin"), getContacts);
router.get("/stats", protect, authorize("admin"), getContactStats);
router.get("/:id", protect, authorize("admin"), getContactById);
router.patch("/:id", protect, authorize("admin"), updateContact);
router.delete("/:id", protect, authorize("admin"), deleteContact);

module.exports = router;
