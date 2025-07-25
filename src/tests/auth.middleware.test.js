const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { protect, authorize } = require("../middleware/auth");
const User = require("../models/user.model");
const { UnauthorizedError, ForbiddenError } = require("../utils/customError");

// Mock dependencies
jest.mock("../models/user.model");
jest.mock("../models/activity.model", () => ({
  logAuthActivity: jest.fn().mockResolvedValue({}),
}));
jest.mock("../config", () => ({
  jwtSecret: "test-secret",
}));

describe("Auth Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("protect middleware", () => {
    it("should return 401 if no token is provided", async () => {
      await protect(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe(
        "Not authorized to access this route"
      );
    });

    it("should return 401 if token is invalid", async () => {
      req.headers.authorization = "Bearer invalid-token";

      await protect(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it("should return 401 if user does not exist", async () => {
      const token = jwt.sign({ id: "nonexistent-id" }, "test-secret");
      req.headers.authorization = `Bearer ${token}`;

      User.findById.mockResolvedValue(null);

      await protect(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("nonexistent-id");
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });

    it("should return 401 if user is inactive", async () => {
      const userId = new mongoose.Types.ObjectId();
      const token = jwt.sign({ id: userId }, "test-secret");
      req.headers.authorization = `Bearer ${token}`;

      User.findById.mockResolvedValue({
        _id: userId,
        name: "Test User",
        email: "test@example.com",
        role: "user",
        status: "inactive",
      });

      await protect(req, res, next);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe(
        "Your account has been deactivated"
      );
    });

    it("should set req.user and call next() if token is valid", async () => {
      const userId = new mongoose.Types.ObjectId();
      const token = jwt.sign({ id: userId }, "test-secret");
      req.headers.authorization = `Bearer ${token}`;

      const mockUser = {
        _id: userId,
        name: "Test User",
        email: "test@example.com",
        role: "user",
        status: "active",
      };

      User.findById.mockResolvedValue(mockUser);

      await protect(req, res, next);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(req.user).toEqual({
        id: mockUser._id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(next).toHaveBeenCalledWith();
    });

    it("should accept token from cookies if not in headers", async () => {
      const userId = new mongoose.Types.ObjectId();
      const token = jwt.sign({ id: userId }, "test-secret");
      req.cookies.token = token;

      const mockUser = {
        _id: userId,
        name: "Test User",
        email: "test@example.com",
        role: "user",
        status: "active",
      };

      User.findById.mockResolvedValue(mockUser);

      await protect(req, res, next);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("authorize middleware", () => {
    beforeEach(() => {
      req.user = {
        id: "user-id",
        role: "user",
      };
    });

    it("should call next() if user has required role", () => {
      const middleware = authorize("user", "admin");
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it("should return 403 if user does not have required role", () => {
      const middleware = authorize("admin");
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].message).toBe(
        "You do not have permission to perform this action"
      );
    });

    it("should return 401 if user is not authenticated", () => {
      req.user = undefined;

      const middleware = authorize("user");
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe(
        "Not authorized to access this route"
      );
    });
  });
});
