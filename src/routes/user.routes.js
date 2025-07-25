const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const userController = require("../controllers/user.controller");
const validate = require("../middleware/validate");
const { protect, authorize } = require("../middleware/auth");

// Validation rules
const updateProfileValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Name cannot be more than 50 characters"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
];

const updateUserValidation = [
  ...updateProfileValidation,
  body("role")
    .optional()
    .isIn(["user", "admin"])
    .withMessage("Role must be either user or admin"),
  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be either active or inactive"),
];

// Profile routes (must come before parameterized routes)
router.get("/profile", protect, userController.getProfile);
router.put(
  "/profile",
  protect,
  updateProfileValidation,
  validate,
  userController.updateProfile
);

// User routes
router.get("/", protect, authorize("admin"), userController.getUsers);
router.get("/:id", protect, authorize("admin"), userController.getUserById);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  updateUserValidation,
  validate,
  userController.updateUser
);
router.delete("/:id", protect, authorize("admin"), userController.deleteUser);

module.exports = router;
