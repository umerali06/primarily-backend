const express = require("express");
const { body } = require("express-validator");
const passport = require("passport");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");

// Validation rules
const registerValidation = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .trim()
    .isLength({ max: 50 })
    .withMessage("Name cannot be more than 50 characters"),
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const loginValidation = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const passwordValidation = [
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const updatePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters"),
];

// Routes
router.post("/register", registerValidation, validate, authController.register);
router.post("/login", loginValidation, validate, authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", protect, authController.logout);
router.get("/me", protect, authController.getMe);
router.post("/forgot-password", authController.forgotPassword);
router.put(
  "/reset-password/:resetToken",
  passwordValidation,
  validate,
  authController.resetPassword
);
router.put(
  "/update-password",
  protect,
  updatePasswordValidation,
  validate,
  authController.updatePassword
);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/auth/login",
    session: false,
  }),
  authController.googleCallback
);

module.exports = router;
