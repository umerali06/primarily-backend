const mongoose = require("mongoose");
const User = require("../models/user.model");
const authController = require("../controllers/auth.controller");
const ApiResponse = require("../utils/apiResponse");
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
} = require("../utils/customError");
const jwt = require("jsonwebtoken");
const config = require("../config");

// Mock dependencies
jest.mock("../models/user.model");
jest.mock("../utils/apiResponse");
jest.mock("jsonwebtoken");
jest.mock("../config/logger");

describe("Auth Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      user: {
        id: "user123",
      },
      protocol: "http",
      get: jest.fn().mockReturnValue("localhost:5000"),
      params: {},
    };
    res = {};
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();

    // Default mock implementations
    ApiResponse.success = jest.fn().mockReturnValue({});
    ApiResponse.created = jest.fn().mockReturnValue({});
  });

  describe("register", () => {
    beforeEach(() => {
      req.body = {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      };
    });

    it("should register a new user successfully", async () => {
      // Mock User.findOne to return null (user doesn't exist)
      User.findOne.mockResolvedValueOnce(null);

      // Mock user creation
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        generateAuthToken: jest.fn().mockReturnValue("token123"),
        generateRefreshToken: jest.fn().mockReturnValue("refresh123"),
        updateLastLogin: jest.fn().mockResolvedValueOnce({}),
      };
      User.create.mockResolvedValueOnce(mockUser);

      await authController.register(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(User.create).toHaveBeenCalledWith({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      });
      expect(mockUser.generateAuthToken).toHaveBeenCalled();
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(mockUser.updateLastLogin).toHaveBeenCalled();
      expect(ApiResponse.created).toHaveBeenCalledWith(
        res,
        "User registered successfully",
        expect.objectContaining({
          user: expect.objectContaining({
            id: "user123",
            name: "Test User",
            email: "test@example.com",
            role: "user",
          }),
          token: "token123",
          refreshToken: "refresh123",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if user already exists", async () => {
      // Mock User.findOne to return a user (user exists)
      User.findOne.mockResolvedValueOnce({
        email: "test@example.com",
      });

      await authController.register(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(User.create).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe(
        "User already exists with that email"
      );
    });

    it("should handle errors", async () => {
      // Mock User.findOne to throw an error
      const error = new Error("Database error");
      User.findOne.mockRejectedValueOnce(error);

      await authController.register(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("login", () => {
    beforeEach(() => {
      req.body = {
        email: "test@example.com",
        password: "password123",
      };
    });

    it("should login user successfully", async () => {
      // Mock user
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        status: "active",
        matchPassword: jest.fn().mockResolvedValueOnce(true),
        generateAuthToken: jest.fn().mockReturnValue("token123"),
        generateRefreshToken: jest.fn().mockReturnValue("refresh123"),
        updateLastLogin: jest.fn().mockResolvedValueOnce({}),
      };
      User.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser),
      });

      await authController.login(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(mockUser.matchPassword).toHaveBeenCalledWith("password123");
      expect(mockUser.generateAuthToken).toHaveBeenCalled();
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(mockUser.updateLastLogin).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Login successful",
        expect.objectContaining({
          user: expect.objectContaining({
            id: "user123",
            name: "Test User",
            email: "test@example.com",
            role: "user",
          }),
          token: "token123",
          refreshToken: "refresh123",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if email or password is missing", async () => {
      req.body = { email: "test@example.com" }; // Missing password

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe(
        "Please provide email and password"
      );
    });

    it("should return error if user doesn't exist", async () => {
      User.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe("Invalid credentials");
    });

    it("should return error if user is inactive", async () => {
      // Mock user with inactive status
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        status: "inactive",
      };
      User.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser),
      });

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe(
        "Your account has been deactivated"
      );
    });

    it("should return error if password is incorrect", async () => {
      // Mock user with incorrect password
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        status: "active",
        matchPassword: jest.fn().mockResolvedValueOnce(false),
      };
      User.findOne.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser),
      });

      await authController.login(req, res, next);

      expect(mockUser.matchPassword).toHaveBeenCalledWith("password123");
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe("Invalid credentials");
    });
  });

  describe("refreshToken", () => {
    beforeEach(() => {
      req.body = {
        refreshToken: "refresh123",
      };
    });

    it("should refresh token successfully", async () => {
      // Mock jwt.verify
      const decoded = { id: "user123" };
      jwt.verify.mockReturnValueOnce(decoded);

      // Mock user
      const mockUser = {
        _id: "user123",
        status: "active",
        generateAuthToken: jest.fn().mockReturnValue("newToken123"),
        generateRefreshToken: jest.fn().mockReturnValue("newRefresh123"),
      };
      User.findById.mockResolvedValueOnce(mockUser);

      await authController.refreshToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(
        "refresh123",
        config.jwtRefreshSecret
      );
      expect(User.findById).toHaveBeenCalledWith("user123");
      expect(mockUser.generateAuthToken).toHaveBeenCalled();
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Token refreshed successfully",
        expect.objectContaining({
          token: "newToken123",
          refreshToken: "newRefresh123",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if refresh token is missing", async () => {
      req.body = {}; // Missing refreshToken

      await authController.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Refresh token is required");
    });

    it("should return error if refresh token is invalid", async () => {
      // Mock jwt.verify to throw an error
      jwt.verify.mockImplementationOnce(() => {
        throw { name: "JsonWebTokenError" };
      });

      await authController.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe(
        "Invalid or expired refresh token"
      );
    });

    it("should return error if user doesn't exist", async () => {
      // Mock jwt.verify
      const decoded = { id: "user123" };
      jwt.verify.mockReturnValueOnce(decoded);

      // Mock user not found
      User.findById.mockResolvedValueOnce(null);

      await authController.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe("Invalid refresh token");
    });

    it("should return error if user is inactive", async () => {
      // Mock jwt.verify
      const decoded = { id: "user123" };
      jwt.verify.mockReturnValueOnce(decoded);

      // Mock user with inactive status
      const mockUser = {
        _id: "user123",
        status: "inactive",
      };
      User.findById.mockResolvedValueOnce(mockUser);

      await authController.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe(
        "Your account has been deactivated"
      );
    });
  });

  describe("logout", () => {
    it("should logout user successfully", async () => {
      await authController.logout(req, res, next);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Logged out successfully"
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("getMe", () => {
    it("should get current user successfully", async () => {
      // Mock user
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        lastLogin: new Date(),
      };
      User.findById.mockResolvedValueOnce(mockUser);

      await authController.getMe(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("user123");
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "User retrieved successfully",
        expect.objectContaining({
          id: "user123",
          name: "Test User",
          email: "test@example.com",
          role: "user",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if user doesn't exist", async () => {
      // Mock user not found
      User.findById.mockResolvedValueOnce(null);

      await authController.getMe(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });
  });

  describe("forgotPassword", () => {
    beforeEach(() => {
      req.body = {
        email: "test@example.com",
      };
    });

    it("should send password reset email successfully", async () => {
      // Mock user
      const mockUser = {
        email: "test@example.com",
        generatePasswordResetToken: jest.fn().mockReturnValue("resetToken123"),
        save: jest.fn().mockResolvedValueOnce({}),
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      await authController.forgotPassword(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(mockUser.generatePasswordResetToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Password reset email sent"
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if user doesn't exist", async () => {
      // Mock user not found
      User.findOne.mockResolvedValueOnce(null);

      await authController.forgotPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe(
        "No user found with that email"
      );
    });
  });

  describe("resetPassword", () => {
    beforeEach(() => {
      req.params = {
        resetToken: "resetToken123",
      };
      req.body = {
        password: "newPassword123",
      };
    });

    it("should reset password successfully", async () => {
      // Mock crypto.createHash
      const crypto = require("crypto");
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue("hashedToken123"),
      };
      crypto.createHash = jest.fn().mockReturnValue(mockHash);

      // Mock user
      const mockUser = {
        password: "oldPassword123",
        resetPasswordToken: "hashedToken123",
        resetPasswordExpire: Date.now() + 3600000, // 1 hour from now
        save: jest.fn().mockResolvedValueOnce({}),
        generateAuthToken: jest.fn().mockReturnValue("token123"),
        generateRefreshToken: jest.fn().mockReturnValue("refresh123"),
        updateLastLogin: jest.fn().mockResolvedValueOnce({}),
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      await authController.resetPassword(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({
        resetPasswordToken: "hashedToken123",
        resetPasswordExpire: { $gt: expect.any(Number) },
      });
      expect(mockUser.password).toBe("newPassword123");
      expect(mockUser.resetPasswordToken).toBeUndefined();
      expect(mockUser.resetPasswordExpire).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.generateAuthToken).toHaveBeenCalled();
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(mockUser.updateLastLogin).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Password reset successful",
        expect.objectContaining({
          token: "token123",
          refreshToken: "refresh123",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if reset token is invalid or expired", async () => {
      // Mock crypto.createHash
      const crypto = require("crypto");
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue("hashedToken123"),
      };
      crypto.createHash = jest.fn().mockReturnValue(mockHash);

      // Mock user not found
      User.findOne.mockResolvedValueOnce(null);

      await authController.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe(
        "Invalid or expired reset token"
      );
    });
  });

  describe("updatePassword", () => {
    beforeEach(() => {
      req.body = {
        currentPassword: "currentPassword123",
        newPassword: "newPassword123",
      };
    });

    it("should update password successfully", async () => {
      // Mock user
      const mockUser = {
        _id: "user123",
        password: "hashedCurrentPassword123",
        matchPassword: jest.fn().mockResolvedValueOnce(true),
        save: jest.fn().mockResolvedValueOnce({}),
        generateAuthToken: jest.fn().mockReturnValue("token123"),
        generateRefreshToken: jest.fn().mockReturnValue("refresh123"),
      };
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser),
      });

      await authController.updatePassword(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("user123");
      expect(mockUser.matchPassword).toHaveBeenCalledWith("currentPassword123");
      expect(mockUser.password).toBe("newPassword123");
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.generateAuthToken).toHaveBeenCalled();
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Password updated successfully",
        expect.objectContaining({
          token: "token123",
          refreshToken: "refresh123",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if current password is incorrect", async () => {
      // Mock user with incorrect password
      const mockUser = {
        _id: "user123",
        password: "hashedCurrentPassword123",
        matchPassword: jest.fn().mockResolvedValueOnce(false),
      };
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser),
      });

      await authController.updatePassword(req, res, next);

      expect(mockUser.matchPassword).toHaveBeenCalledWith("currentPassword123");
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe(
        "Current password is incorrect"
      );
    });
  });

  describe("googleLogin", () => {
    it("should redirect to Google OAuth callback", async () => {
      // Mock res.redirect
      res.redirect = jest.fn();

      await authController.googleLogin(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith("/api/auth/google/callback");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("googleCallback", () => {
    it("should authenticate existing user with Google", async () => {
      // Mock existing user
      const mockUser = {
        _id: "user123",
        name: "Google User",
        email: "google-user@example.com",
        role: "user",
        googleId: "google123",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-02"), // Different from createdAt
        updateLastLogin: jest.fn().mockResolvedValueOnce({}),
        generateAuthToken: jest.fn().mockReturnValue("token123"),
        generateRefreshToken: jest.fn().mockReturnValue("refresh123"),
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      await authController.googleCallback(req, res, next);

      expect(User.findOne).toHaveBeenCalled();
      expect(mockUser.updateLastLogin).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        action: "login",
        details: {
          method: "google",
        },
      });
      expect(mockUser.generateAuthToken).toHaveBeenCalled();
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Google authentication successful",
        expect.objectContaining({
          user: expect.objectContaining({
            id: "user123",
            name: "Google User",
            email: "google-user@example.com",
          }),
          token: "token123",
          refreshToken: "refresh123",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should create new user with Google", async () => {
      // Mock user not found, then created
      User.findOne.mockResolvedValueOnce(null);

      const mockCreatedUser = {
        _id: "user123",
        name: "Google User",
        email: "google-user@example.com",
        role: "user",
        googleId: "google123",
        createdAt: new Date(),
        updatedAt: new Date(), // Same as createdAt for new user
        updateLastLogin: jest.fn().mockResolvedValueOnce({}),
        generateAuthToken: jest.fn().mockReturnValue("token123"),
        generateRefreshToken: jest.fn().mockReturnValue("refresh123"),
      };
      User.create.mockResolvedValueOnce(mockCreatedUser);

      await authController.googleCallback(req, res, next);

      expect(User.findOne).toHaveBeenCalled();
      expect(User.create).toHaveBeenCalled();
      expect(mockCreatedUser.updateLastLogin).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        action: "register",
        details: {
          method: "google",
        },
      });
      expect(mockCreatedUser.generateAuthToken).toHaveBeenCalled();
      expect(mockCreatedUser.generateRefreshToken).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Google authentication successful",
        expect.objectContaining({
          user: expect.objectContaining({
            id: "user123",
            name: "Google User",
            email: "google-user@example.com",
          }),
          token: "token123",
          refreshToken: "refresh123",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should update googleId for existing user", async () => {
      // Mock existing user without googleId
      const mockUser = {
        _id: "user123",
        name: "Google User",
        email: "google-user@example.com",
        role: "user",
        googleId: null,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-02"),
        save: jest.fn().mockResolvedValueOnce({}),
        updateLastLogin: jest.fn().mockResolvedValueOnce({}),
        generateAuthToken: jest.fn().mockReturnValue("token123"),
        generateRefreshToken: jest.fn().mockReturnValue("refresh123"),
      };
      User.findOne.mockResolvedValueOnce(mockUser);

      await authController.googleCallback(req, res, next);

      expect(mockUser.googleId).toBe("google123");
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.updateLastLogin).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalled();
      expect(mockUser.generateAuthToken).toHaveBeenCalled();
      expect(mockUser.generateRefreshToken).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      User.findOne.mockRejectedValueOnce(error);

      await authController.googleCallback(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
