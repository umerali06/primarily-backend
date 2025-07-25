const express = require("express");
const { body, param } = require("express-validator");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { protect, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");

// All admin routes require admin role
router.use(protect, authorize("admin"));

// User management routes
router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserDetails);

router.put(
  "/users/:id/status",
  [
    param("id").isMongoId().withMessage("Invalid user ID"),
    body("status")
      .notEmpty()
      .withMessage("Status is required")
      .isIn(["active", "inactive"])
      .withMessage("Invalid status"),
  ],
  validate,
  adminController.updateUserStatus
);

router.post(
  "/users/:id/reset-password",
  [param("id").isMongoId().withMessage("Invalid user ID")],
  validate,
  adminController.resetUserPassword
);

// System metrics
router.get("/metrics", adminController.getSystemMetrics);

module.exports = router;
