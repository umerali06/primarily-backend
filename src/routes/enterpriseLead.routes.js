const express = require("express");
const router = express.Router();
const {
  createEnterpriseLead,
  getEnterpriseLeads,
  updateEnterpriseLeadStatus,
  getEnterpriseLeadById,
  deleteEnterpriseLead,
} = require("../controllers/enterpriseLead.controller");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/auth");

// Public routes
router.post("/", createEnterpriseLead);

// Admin routes (require authentication and admin permissions)
router.get("/", protect, authorize("admin"), getEnterpriseLeads);
router.get("/:id", protect, authorize("admin"), getEnterpriseLeadById);
router.patch("/:id", protect, authorize("admin"), updateEnterpriseLeadStatus);
router.delete("/:id", protect, authorize("admin"), deleteEnterpriseLead);

module.exports = router;
