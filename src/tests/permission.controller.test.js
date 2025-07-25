const permissionController = require('../controllers/permission.controller');
const Permission = require('../models/permission.model');
const User = require('../models/user.model');
const Item = require('../models/item.model');
const Folder = require('../models/folder.model');
const Activity = require('../models/activity.model');
const ApiResponse = require('../utils/apiResponse');
const CustomError = require('../utils/customError'
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require("../utils/customError");

// Mock dependencies
jest.mock("../models/permission.model");
jest.mock("../models/user.model");
jest.mock("../models/activity.model");
jest.mock("../middleware/permission");
jest.mock("../utils/apiResponse");

// Mock mongoose
jest.mock("mongoose", () => {
  const originalMongoose = jest.requireActual("mongoose");
  return {
    ...originalMongoose,
    model: jest.fn().mockImplementation((modelName) => {
      if (modelName === "Item") {
        return {
          findById: jest.fn(),
        };
      } else if (modelName === "Folder") {
        return {
          findById: jest.fn(),
        };
      }
      return null;
    }),
    Types: {
      ObjectId: {
        isValid: jest.fn().mockReturnValue(true),
      },
    },
  };
});

describe("Permission Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        id: "user123",
        role: "user",
      },
      params: {},
      body: {},
    };
    res = {};
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();

    // Default mock implementations
    ApiResponse.success = jest.fn().mockReturnValue({});
    ApiResponse.created = jest.fn().mockReturnValue({});
  });

  describe("getResourcePermissions", () => {
    beforeEach(() => {
      req.params = {
        resourceType: "Item",
        resourceId: "resource123",
      };
    });

    it("should return 400 for invalid resource type", async () => {
      req.params.resourceType = "InvalidType";

      await permissionController.getResourcePermissions(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Invalid resource type");
    });

    it("should return 400 for invalid resource ID", async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);

      await permissionController.getResourcePermissions(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Invalid resource ID");
    });

    it("should return 404 if resource doesn't exist", async () => {
      mongoose.model("Item").findById.mockResolvedValueOnce(null);

      await permissionController.getResourcePermissions(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should return 403 if user doesn't have permission", async () => {
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "otherUser",
      });
      isResourceOwner.mockReturnValueOnce(false);
      hasAdminAccess.mockResolvedValueOnce(false);

      await permissionController.getResourcePermissions(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it("should return permissions if user is owner", async () => {
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "user123",
      });
      isResourceOwner.mockReturnValueOnce(true);

      const mockPermissions = [
        {
          _id: "perm1",
          userId: {
            _id: "user456",
            name: "Test User",
            email: "test@example.com",
          },
          accessLevel: "view",
          createdAt: new Date(),
        },
      ];

      Permission.find.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockPermissions),
      });

      await permissionController.getResourcePermissions(req, res, next);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Permissions retrieved successfully",
        expect.objectContaining({
          permissions: expect.arrayContaining([
            expect.objectContaining({
              id: "perm1",
              user: expect.objectContaining({
                id: "user456",
                name: "Test User",
                email: "test@example.com",
              }),
              accessLevel: "view",
            }),
          ]),
        })
      );
    });

    it("should return permissions if user has admin access", async () => {
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "otherUser",
      });
      isResourceOwner.mockReturnValueOnce(false);
      hasAdminAccess.mockResolvedValueOnce(true);

      const mockPermissions = [
        {
          _id: "perm1",
          userId: {
            _id: "user456",
            name: "Test User",
            email: "test@example.com",
          },
          accessLevel: "view",
          createdAt: new Date(),
        },
      ];

      Permission.find.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockPermissions),
      });

      await permissionController.getResourcePermissions(req, res, next);

      expect(ApiResponse.success).toHaveBeenCalled();
    });
  });

  describe("grantPermission", () => {
    beforeEach(() => {
      req.body = {
        resourceType: "Item",
        resourceId: "resource123",
        userId: "user456",
        accessLevel: "view",
      };
    });

    it("should return 400 for invalid resource type", async () => {
      req.body.resourceType = "InvalidType";

      await permissionController.grantPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Invalid resource type");
    });

    it("should return 400 for invalid access level", async () => {
      req.body.accessLevel = "invalid";

      await permissionController.grantPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Invalid access level");
    });

    it("should return 404 if user doesn't exist", async () => {
      User.findById.mockResolvedValueOnce(null);

      await permissionController.grantPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("User not found");
    });

    it("should return 404 if resource doesn't exist", async () => {
      User.findById.mockResolvedValueOnce({ _id: "user456" });
      mongoose.model("Item").findById.mockResolvedValueOnce(null);

      await permissionController.grantPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should return 403 if user doesn't have permission", async () => {
      User.findById.mockResolvedValueOnce({ _id: "user456" });
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "otherUser",
      });
      isResourceOwner.mockReturnValueOnce(false);
      hasAdminAccess.mockResolvedValueOnce(false);

      await permissionController.grantPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it("should return 400 if granting permission to self", async () => {
      req.body.userId = "user123"; // Same as req.user.id
      User.findById.mockResolvedValueOnce({ _id: "user123" });
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "user123",
      });
      isResourceOwner.mockReturnValueOnce(true);

      await permissionController.grantPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe(
        "Cannot grant permissions to yourself"
      );
    });

    it("should grant permission successfully", async () => {
      User.findById.mockResolvedValueOnce({ _id: "user456" });
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "user123",
      });
      isResourceOwner.mockReturnValueOnce(true);

      const mockPermission = {
        _id: "perm1",
        resourceId: "resource123",
        resourceType: "Item",
        userId: "user456",
        accessLevel: "view",
        createdAt: new Date(),
      };

      Permission.grantPermission.mockResolvedValueOnce(mockPermission);

      await permissionController.grantPermission(req, res, next);

      expect(Permission.grantPermission).toHaveBeenCalledWith(
        "user123",
        "user456",
        "resource123",
        "Item",
        "view"
      );
      expect(Activity.create).toHaveBeenCalled();
      expect(ApiResponse.created).toHaveBeenCalledWith(
        res,
        "Permission granted successfully",
        expect.objectContaining({
          permission: expect.objectContaining({
            id: "perm1",
            resourceId: "resource123",
            resourceType: "Item",
            userId: "user456",
            accessLevel: "view",
          }),
        })
      );
    });
  });

  describe("updatePermission", () => {
    beforeEach(() => {
      req.params = {
        id: "perm123",
      };
      req.body = {
        accessLevel: "edit",
      };
    });

    it("should return 400 for invalid permission ID", async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);

      await permissionController.updatePermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Invalid permission ID");
    });

    it("should return 400 for invalid access level", async () => {
      req.body.accessLevel = "invalid";

      await permissionController.updatePermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Invalid access level");
    });

    it("should return 404 if permission doesn't exist", async () => {
      Permission.findById.mockResolvedValueOnce(null);

      await permissionController.updatePermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Permission not found");
    });

    it("should return 404 if resource doesn't exist", async () => {
      Permission.findById.mockResolvedValueOnce({
        resourceId: "resource123",
        resourceType: "Item",
      });
      mongoose.model("Item").findById.mockResolvedValueOnce(null);

      await permissionController.updatePermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should return 403 if user doesn't have permission", async () => {
      Permission.findById.mockResolvedValueOnce({
        resourceId: "resource123",
        resourceType: "Item",
      });
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "otherUser",
      });
      isResourceOwner.mockReturnValueOnce(false);
      hasAdminAccess.mockResolvedValueOnce(false);

      await permissionController.updatePermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it("should update permission successfully", async () => {
      const mockPermission = {
        _id: "perm123",
        resourceId: "resource123",
        resourceType: "Item",
        userId: "user456",
        accessLevel: "view",
        save: jest.fn().mockResolvedValueOnce({}),
        updatedAt: new Date(),
      };

      Permission.findById.mockResolvedValueOnce(mockPermission);
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "user123",
      });
      isResourceOwner.mockReturnValueOnce(true);

      await permissionController.updatePermission(req, res, next);

      expect(mockPermission.accessLevel).toBe("edit");
      expect(mockPermission.grantedBy).toBe("user123");
      expect(mockPermission.save).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Permission updated successfully",
        expect.objectContaining({
          permission: expect.objectContaining({
            id: "perm123",
            accessLevel: "edit",
          }),
        })
      );
    });
  });

  describe("revokePermission", () => {
    beforeEach(() => {
      req.params = {
        id: "perm123",
      };
    });

    it("should return 400 for invalid permission ID", async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);

      await permissionController.revokePermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Invalid permission ID");
    });

    it("should return 404 if permission doesn't exist", async () => {
      Permission.findById.mockResolvedValueOnce(null);

      await permissionController.revokePermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Permission not found");
    });

    it("should return 404 if resource doesn't exist", async () => {
      Permission.findById.mockResolvedValueOnce({
        resourceId: "resource123",
        resourceType: "Item",
      });
      mongoose.model("Item").findById.mockResolvedValueOnce(null);

      await permissionController.revokePermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should return 403 if user doesn't have permission", async () => {
      Permission.findById.mockResolvedValueOnce({
        resourceId: "resource123",
        resourceType: "Item",
      });
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "otherUser",
      });
      isResourceOwner.mockReturnValueOnce(false);
      hasAdminAccess.mockResolvedValueOnce(false);

      await permissionController.revokePermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it("should revoke permission successfully", async () => {
      const mockPermission = {
        _id: "perm123",
        resourceId: "resource123",
        resourceType: "Item",
        userId: "user456",
        save: jest.fn().mockResolvedValueOnce({}),
      };

      Permission.findById.mockResolvedValueOnce(mockPermission);
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "user123",
      });
      isResourceOwner.mockReturnValueOnce(true);

      await permissionController.revokePermission(req, res, next);

      expect(mockPermission.isActive).toBe(false);
      expect(mockPermission.save).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Permission revoked successfully"
      );
    });
  });

  describe("checkUserPermission", () => {
    beforeEach(() => {
      req.params = {
        resourceType: "Item",
        resourceId: "resource123",
        accessLevel: "edit",
      };
    });

    it("should return 400 for invalid resource type", async () => {
      req.params.resourceType = "InvalidType";

      await permissionController.checkUserPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Invalid resource type");
    });

    it("should return 400 for invalid access level", async () => {
      req.params.accessLevel = "invalid";

      await permissionController.checkUserPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Invalid access level");
    });

    it("should return 404 if resource doesn't exist", async () => {
      mongoose.model("Item").findById.mockResolvedValueOnce(null);

      await permissionController.checkUserPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should return permission check result", async () => {
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "otherUser",
      });
      isResourceOwner.mockReturnValueOnce(false);
      Permission.hasPermission.mockResolvedValueOnce(true);

      await permissionController.checkUserPermission(req, res, next);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Permission check completed",
        expect.objectContaining({
          hasPermission: true,
          isOwner: false,
          isAdmin: false,
          hasExplicitPermission: true,
        })
      );
    });

    it("should return true for resource owner", async () => {
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "user123",
      });
      isResourceOwner.mockReturnValueOnce(true);
      Permission.hasPermission.mockResolvedValueOnce(false);

      await permissionController.checkUserPermission(req, res, next);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Permission check completed",
        expect.objectContaining({
          hasPermission: true,
          isOwner: true,
          isAdmin: false,
          hasExplicitPermission: false,
        })
      );
    });

    it("should return true for admin user", async () => {
      req.user.role = "admin";
      mongoose.model("Item").findById.mockResolvedValueOnce({
        userId: "otherUser",
      });
      isResourceOwner.mockReturnValueOnce(false);
      Permission.hasPermission.mockResolvedValueOnce(false);

      await permissionController.checkUserPermission(req, res, next);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Permission check completed",
        expect.objectContaining({
          hasPermission: true,
          isOwner: false,
          isAdmin: true,
          hasExplicitPermission: false,
        })
      );
    });
  });
});
