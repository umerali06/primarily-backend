const mongoose = require("mongoose");
const User = require("../models/user.model");
const Activity = require("../models/activity.model");
const userController = require("../controllers/user.controller");
const ApiResponse = require("../utils/apiResponse");
const {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} = require("../utils/customError");

// Mock dependencies
jest.mock("../models/user.model");
jest.mock("../models/activity.model");
jest.mock("../utils/apiResponse");

describe("User Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        id: "user123",
        role: "user",
      },
      params: {},
      body: {},
      query: {},
    };
    res = {};
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();

    // Default mock implementations
    ApiResponse.success = jest.fn().mockReturnValue({});
  });

  describe("getProfile", () => {
    it("should get user profile successfully", async () => {
      // Mock user
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        status: "active",
        lastLogin: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser),
      });

      await userController.getProfile(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("user123");
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Profile retrieved successfully",
        expect.objectContaining({
          user: expect.objectContaining({
            id: "user123",
            name: "Test User",
            email: "test@example.com",
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if user doesn't exist", async () => {
      // Mock user not found
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });

      await userController.getProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockRejectedValueOnce(error),
      });

      await userController.getProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateProfile", () => {
    beforeEach(() => {
      req.body = {
        name: "Updated Name",
        email: "updated@example.com",
      };
    });

    it("should update profile successfully", async () => {
      // Mock user
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        status: "active",
        lastLogin: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValueOnce({
          _id: "user123",
          name: "Updated Name",
          email: "updated@example.com",
          role: "user",
          status: "active",
          lastLogin: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      };
      User.findById.mockResolvedValueOnce(mockUser);
      User.findOne.mockResolvedValueOnce(null); // No user with the new email

      await userController.updateProfile(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("user123");
      expect(User.findOne).toHaveBeenCalledWith({
        email: "updated@example.com",
      });
      expect(mockUser.name).toBe("Updated Name");
      expect(mockUser.email).toBe("updated@example.com");
      expect(mockUser.save).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        action: "update_profile",
        details: {
          changes: {
            name: { from: "Test User", to: "Updated Name" },
            email: { from: "test@example.com", to: "updated@example.com" },
          },
        },
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Profile updated successfully",
        expect.objectContaining({
          user: expect.objectContaining({
            name: "Updated Name",
            email: "updated@example.com",
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should not log activity if no changes were made", async () => {
      // Mock user with same name and email as in request
      const mockUser = {
        _id: "user123",
        name: "Updated Name",
        email: "updated@example.com",
        role: "user",
        status: "active",
        save: jest.fn().mockResolvedValueOnce({
          _id: "user123",
          name: "Updated Name",
          email: "updated@example.com",
          role: "user",
          status: "active",
        }),
      };
      User.findById.mockResolvedValueOnce(mockUser);

      await userController.updateProfile(req, res, next);

      expect(mockUser.save).toHaveBeenCalled();
      expect(Activity.create).not.toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if user doesn't exist", async () => {
      // Mock user not found
      User.findById.mockResolvedValueOnce(null);

      await userController.updateProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });

    it("should return error if email is already in use", async () => {
      // Mock user
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
      };
      User.findById.mockResolvedValueOnce(mockUser);

      // Mock existing user with the new email
      User.findOne.mockResolvedValueOnce({
        _id: "user456",
        email: "updated@example.com",
      });

      await userController.updateProfile(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({
        email: "updated@example.com",
      });
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Email already in use");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      User.findById.mockRejectedValueOnce(error);

      await userController.updateProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getUsers", () => {
    it("should get all users with pagination", async () => {
      // Mock users
      const mockUsers = [
        { _id: "user1", name: "User 1" },
        { _id: "user2", name: "User 2" },
      ];
      User.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce(mockUsers),
      });
      User.countDocuments.mockResolvedValueOnce(10);

      await userController.getUsers(req, res, next);

      expect(User.find).toHaveBeenCalled();
      expect(User.countDocuments).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Users retrieved successfully",
        expect.objectContaining({
          users: mockUsers,
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 10,
            pages: 1,
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle custom pagination parameters", async () => {
      // Set custom pagination parameters
      req.query = {
        page: "2",
        limit: "5",
      };

      // Mock users
      const mockUsers = [
        { _id: "user6", name: "User 6" },
        { _id: "user7", name: "User 7" },
      ];
      User.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce(mockUsers),
      });
      User.countDocuments.mockResolvedValueOnce(10);

      await userController.getUsers(req, res, next);

      expect(User.find).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Users retrieved successfully",
        expect.objectContaining({
          users: mockUsers,
          pagination: expect.objectContaining({
            page: 2,
            limit: 5,
            total: 10,
            pages: 2,
          }),
        })
      );
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      User.find.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValueOnce(error),
      });

      await userController.getUsers(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getUserById", () => {
    beforeEach(() => {
      req.params.id = "user456";
    });

    it("should get user by ID successfully", async () => {
      // Mock user
      const mockUser = {
        _id: "user456",
        name: "Test User",
        email: "test@example.com",
        role: "user",
      };
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser),
      });

      await userController.getUserById(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("user456");
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "User retrieved successfully",
        expect.objectContaining({
          user: mockUser,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if user doesn't exist", async () => {
      // Mock user not found
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null),
      });

      await userController.getUserById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      User.findById.mockReturnValueOnce({
        select: jest.fn().mockRejectedValueOnce(error),
      });

      await userController.getUserById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateUser", () => {
    beforeEach(() => {
      req.params.id = "user456";
      req.body = {
        name: "Updated Name",
        email: "updated@example.com",
        role: "admin",
        status: "inactive",
      };
    });

    it("should update user successfully", async () => {
      // Mock user
      const mockUser = {
        _id: "user456",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        status: "active",
        save: jest.fn().mockResolvedValueOnce({
          _id: "user456",
          name: "Updated Name",
          email: "updated@example.com",
          role: "admin",
          status: "inactive",
        }),
      };
      User.findById.mockResolvedValueOnce(mockUser);
      User.findOne.mockResolvedValueOnce(null); // No user with the new email

      await userController.updateUser(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("user456");
      expect(User.findOne).toHaveBeenCalledWith({
        email: "updated@example.com",
      });
      expect(mockUser.name).toBe("Updated Name");
      expect(mockUser.email).toBe("updated@example.com");
      expect(mockUser.role).toBe("admin");
      expect(mockUser.status).toBe("inactive");
      expect(mockUser.save).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "User updated successfully",
        expect.objectContaining({
          user: expect.objectContaining({
            name: "Updated Name",
            email: "updated@example.com",
            role: "admin",
            status: "inactive",
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if user doesn't exist", async () => {
      // Mock user not found
      User.findById.mockResolvedValueOnce(null);

      await userController.updateUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });

    it("should return error if email is already in use", async () => {
      // Mock user
      const mockUser = {
        _id: "user456",
        name: "Test User",
        email: "test@example.com",
      };
      User.findById.mockResolvedValueOnce(mockUser);

      // Mock existing user with the new email
      User.findOne.mockResolvedValueOnce({
        _id: "user789",
        email: "updated@example.com",
      });

      await userController.updateUser(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({
        email: "updated@example.com",
      });
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Email already in use");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      User.findById.mockRejectedValueOnce(error);

      await userController.updateUser(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteUser", () => {
    beforeEach(() => {
      req.params.id = "user456";
    });

    it("should delete user successfully", async () => {
      // Mock user
      const mockUser = {
        _id: "user456",
        deleteOne: jest.fn().mockResolvedValueOnce({}),
      };
      User.findById.mockResolvedValueOnce(mockUser);

      await userController.deleteUser(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("user456");
      expect(mockUser.deleteOne).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "User deleted successfully"
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if user doesn't exist", async () => {
      // Mock user not found
      User.findById.mockResolvedValueOnce(null);

      await userController.deleteUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });

    it("should prevent deleting own account", async () => {
      // Mock user as the current user
      const mockUser = {
        _id: "user123", // Same as req.user.id
      };
      User.findById.mockResolvedValueOnce(mockUser);

      await userController.deleteUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(next.mock.calls[0][0].message).toBe(
        "Cannot delete your own account"
      );
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      User.findById.mockRejectedValueOnce(error);

      await userController.deleteUser(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
