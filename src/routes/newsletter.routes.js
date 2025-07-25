const express = require("express");
const router = express.Router();
const {
  subscribe,
  unsubscribe,
  updatePreferences,
  getSubscriptions,
  getNewsletterStats,
  exportSubscribers,
} = require("../controllers/newsletter.controller");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.post("/subscribe", subscribe);
router.get("/unsubscribe", unsubscribe);
router.patch("/preferences", updatePreferences);

// Admin routes (require authentication and admin permissions)
router.get("/", protect, authorize("admin"), getSubscriptions);
router.get("/stats", protect, authorize("admin"), getNewsletterStats);
router.get("/export", protect, authorize("admin"), exportSubscribers);

module.exports = router;
