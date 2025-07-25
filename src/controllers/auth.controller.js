const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Activity = require("../models/activity.model");
const ApiResponse = require("../utils/apiResponse");
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
} = require("../utils/customError");
const logger = require("../config/logger");
const config = require("../config");

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new BadRequestError("User already exists with that email"));
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    // Generate tokens
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Update last login
    await user.updateLastLogin();

    // Log activity
    await Activity.create({
      userId: user._id,
      resourceId: user._id,
      resourceType: "user",
      action: "register",
      details: {
        method: "email",
      },
    });

    // Send response
    return ApiResponse.created(res, "User registered successfully", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return next(new BadRequestError("Please provide email and password"));
    }

    // Check if user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(new UnauthorizedError("Invalid credentials"));
    }

    // Check if user is active
    if (user.status !== "active") {
      return next(new UnauthorizedError("Your account has been deactivated"));
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(new UnauthorizedError("Invalid credentials"));
    }

    // Generate tokens
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Update last login
    await user.updateLastLogin();

    // Log activity
    await Activity.create({
      userId: user._id,
      resourceId: user._id,
      resourceType: "user",
      action: "login",
      details: {
        method: "email",
      },
    });

    // Send response
    return ApiResponse.success(res, "Login successful", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new BadRequestError("Refresh token is required"));
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);

    // Get user
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new UnauthorizedError("Invalid refresh token"));
    }

    // Check if user is active
    if (user.status !== "active") {
      return next(new UnauthorizedError("Your account has been deactivated"));
    }

    // Generate new tokens
    const newToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();

    // Send response
    return ApiResponse.success(res, "Token refreshed successfully", {
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return next(new UnauthorizedError("Invalid or expired refresh token"));
    }
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    // Note: In a stateless JWT authentication system, the client is responsible for
    // discarding the token. The server can't invalidate the token directly.
    // For a more secure logout, you would need to implement a token blacklist or
    // use short-lived tokens with a refresh token system.

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: req.user.id,
      resourceType: "user",
      action: "logout",
      details: {
        method: "manual",
      },
    });

    // Clear cookies if they exist
    if (req.cookies && req.cookies.token) {
      res.clearCookie("token");
    }

    if (req.cookies && req.cookies.refreshToken) {
      res.clearCookie("refreshToken");
    }

    return ApiResponse.success(res, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    return ApiResponse.success(res, "User retrieved successfully", {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return next(new NotFoundError("No user found with that email"));
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/auth/reset-password/${resetToken}`;

    // Log activity
    await Activity.create({
      userId: user._id,
      resourceId: user._id,
      resourceType: "user",
      action: "forgot_password",
      details: {
        email: user.email,
      },
    });

    // In a real application, you would send an email with the reset URL
    // For now, we'll just log it
    logger.info(`Password reset token: ${resetToken}`);
    logger.info(`Reset URL: ${resetUrl}`);

    return ApiResponse.success(res, "Password reset email sent");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/reset-password/:resetToken
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;

    // Hash the reset token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Find user by reset token
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(new BadRequestError("Invalid or expired reset token"));
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new tokens
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Update last login
    await user.updateLastLogin();

    // Log activity
    await Activity.create({
      userId: user._id,
      resourceId: user._id,
      resourceType: "user",
      action: "reset_password",
      details: {},
    });

    return ApiResponse.success(res, "Password reset successful", {
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select("+password");

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return next(new BadRequestError("Current password is incorrect"));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new tokens
    const token = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    // Log activity
    await Activity.create({
      userId: user._id,
      resourceId: user._id,
      resourceType: "user",
      action: "update_password",
      details: {},
    });

    return ApiResponse.success(res, "Password updated successfully", {
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Google OAuth callback
 * @route   GET /api/auth/google/callback
 * @access  Public
 */
exports.googleCallback = (req, res, next) => {
  try {
    // Generate tokens
    const token = req.user.generateAuthToken();
    const refreshToken = req.user.generateRefreshToken();

    // Set cookies if using cookie-based auth
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // Redirect to frontend with tokens
    const config = require("../config");
    const redirectUrl = `${config.frontendUrl}/auth/success?token=${token}&refreshToken=${refreshToken}`;

    return res.redirect(redirectUrl);
  } catch (error) {
    next(error);
  }
};
