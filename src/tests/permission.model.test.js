const mongoose = require("mongoose");
const Permission = require("../models/permission.model");
const User = require("../models/user.model");
const Item = require("../models/item.model");
const Folder = require("../models/folder.model");

// Mock the models
jest.mock("../models/user.model");
jest.mock("../models/item.model");
jest.mock("../models/folder.model");

describe("Permission Model", () => {
  let mockUser1, mockUser2, mockItem, mockFolder;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser1 = {
      _id: new mongoose.Types.ObjectId(),
      name: "Test User 1",
      email: "user1@example.com",
    };

    mockUser2 = {
      _id: new mongoose.Types.ObjectId(),
      name: "Test User 2",
      email: "user2@example.com",
    };

    mockItem = {
      _id: new mongoose.Types.ObjectId(),
      name: "Test Item",
      userId: mockUser1._id,
    };

    mockFolder = {
      _id: new mongoose.Types.ObjectId(),
      name: "Test Folder",
      userId: mockUser1._id,
    };
  });

  describe("Schema Validation", () => {
    it("should create a valid permission", async () => {
      const permissionData = {
        resourceId: mockItem._id,
        resourceType: "Item",
        userId: mockUser2._id,
        accessLevel: "view",
        grantedBy: mockUser1._id,
      };

      const permission = new Permission(permissionData);
      const validationError = permission.validateSync();

      expect(validationError).toBeUndefined();
      expect(permission.resourceId).toBe(mockItem._id);
      expect(permission.resourceType).toBe("Item");
      expect(permission.userId).toBe(mockUser2._id);
      expect(permission.accessLevel).toBe("view");
      expect(permission.grantedBy).toBe(mockUser1._id);
    });

    it("should require resourceId", () => {
      const permissionData = {
        resourceType: "Item",
        userId: mockUser2._id,
        accessLevel: "view",
        grantedBy: mockUser1._id,
      };

      const permission = new Permission(permissionData);
      const validationError = permission.validateSync();

      expect(validationError.errors.resourceId).toBeDefined();
    });

    it("should require resourceType", () => {
      const permissionData = {
        resourceId: mockItem._id,
        userId: mockUser2._id,
        accessLevel: "view",
        grantedBy: mockUser1._id,
      };

      const permission = new Permission(permissionData);
      const validationError = permission.validateSync();

      expect(validationError.errors.resourceType).toBeDefined();
    });

    it("should require userId", () => {
      const permissionData = {
        resourceId: mockItem._id,
        resourceType: "Item",
        accessLevel: "view",
        grantedBy: mockUser1._id,
      };

      const permission = new Permission(permissionData);
      const validationError = permission.validateSync();

      expect(validationError.errors.userId).toBeDefined();
    });

    it("should require grantedBy", () => {
      const permissionData = {
        resourceId: mockItem._id,
        resourceType: "Item",
        userId: mockUser2._id,
        accessLevel: "view",
      };

      const permission = new Permission(permissionData);
      const validationError = permission.validateSync();

      expect(validationError.errors.grantedBy).toBeDefined();
    });

    it("should validate resourceType enum", () => {
      const permissionData = {
        resourceId: mockItem._id,
        resourceType: "InvalidType",
        userId: mockUser2._id,
        accessLevel: "view",
        grantedBy: mockUser1._id,
      };

      const permission = new Permission(permissionData);
      const validationError = permission.validateSync();

      expect(validationError.errors.resourceType).toBeDefined();
    });

    it("should validate accessLevel enum", () => {
      const permissionData = {
        resourceId: mockItem._id,
        resourceType: "Item",
        userId: mockUser2._id,
        accessLevel: "invalid",
        grantedBy: mockUser1._id,
      };

      const permission = new Permission(permissionData);
      const validationError = permission.validateSync();

      expect(validationError.errors.accessLevel).toBeDefined();
    });

    it("should default accessLevel to view", () => {
      const permissionData = {
        resourceId: mockItem._id,
        resourceType: "Item",
        userId: mockUser2._id,
        grantedBy: mockUser1._id,
      };

      const permission = new Permission(permissionData);
      expect(permission.accessLevel).toBe("view");
    });
  });

  describe("Virtual Properties", () => {
    it("should return false for isExpired when expiresAt is null", () => {
      const permission = new Permission({
        resourceId: mockItem._id,
        resourceType: "Item",
        userId: mockUser2._id,
        accessLevel: "view",
        grantedBy: mockUser1._id,
        expiresAt: null,
      });

      expect(permission.isExpired).toBe(false);
    });

    it("should return false for isExpired when expiresAt is in the future", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const permission = new Permission({
        resourceId: mockItem._id,
        resourceType: "Item",
        userId: mockUser2._id,
        accessLevel: "view",
        grantedBy: mockUser1._id,
        expiresAt: futureDate,
      });

      expect(permission.isExpired).toBe(false);
    });

    it("should return true for isExpired when expiresAt is in the past", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const permission = new Permission({
        resourceId: mockItem._id,
        resourceType: "Item",
        userId: mockUser2._id,
        accessLevel: "view",
        grantedBy: mockUser1._id,
        expiresAt: pastDate,
      });

      expect(permission.isExpired).toBe(true);
    });
  });

  describe("Instance Methods", () => {
    it("should return true for isValid when permission is not expired", () => {
      const permission = new Permission({
        resourceId: mockItem._id,
        resourceType: "Item",
        userId: mockUser2._id,
        accessLevel: "view",
        grantedBy: mockUser1._id,
        expiresAt: null,
      });

      expect(permission.isValid()).toBe(true);
    });

    it("should return false for isValid when permission is expired", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const permission = new Permission({
        resourceId: mockItem._id,
        resourceType: "Item",
        userId: mockUser2._id,
        accessLevel: "view",
        grantedBy: mockUser1._id,
        expiresAt: pastDate,
      });

      expect(permission.isValid()).toBe(false);
    });
  });

  describe("Static Methods", () => {
    beforeEach(() => {
      // Mock Permission methods
      Permission.findOne = jest.fn();
      Permission.find = jest.fn();
      Permission.create = jest.fn();
      Permission.deleteOne = jest.fn();
    });

    describe("hasPermission", () => {
      it("should return true when user has sufficient permission", async () => {
        const mockPermission = {
          userId: mockUser2._id,
          resourceId: mockItem._id,
          resourceType: "Item",
          accessLevel: "edit",
          expiresAt: null,
        };

        Permission.findOne.mockResolvedValue(mockPermission);

        const result = await Permission.hasPermission(
          mockUser2._id,
          mockItem._id,
          "Item",
          "view"
        );

        expect(result).toBe(true);
        expect(Permission.findOne).toHaveBeenCalledWith({
          userId: mockUser2._id,
          resourceId: mockItem._id,
          resourceType: "Item",
          $or: [{ expiresAt: null }, { expiresAt: { $gt: expect.any(Date) } }],
        });
      });

      it("should return false when user has insufficient permission", async () => {
        const mockPermission = {
          userId: mockUser2._id,
          resourceId: mockItem._id,
          resourceType: "Item",
          accessLevel: "view",
          expiresAt: null,
        };

        Permission.findOne.mockResolvedValue(mockPermission);

        const result = await Permission.hasPermission(
          mockUser2._id,
          mockItem._id,
          "Item",
          "admin"
        );

        expect(result).toBe(false);
      });

      it("should return false when no permission exists", async () => {
        Permission.findOne.mockResolvedValue(null);

        const result = await Permission.hasPermission(
          mockUser2._id,
          mockItem._id,
          "Item",
          "view"
        );

        expect(result).toBe(false);
      });
    });

    describe("grantPermission", () => {
      it("should create new permission when none exists", async () => {
        const mockNewPermission = {
          resourceId: mockItem._id,
          resourceType: "Item",
          userId: mockUser2._id,
          accessLevel: "view",
          grantedBy: mockUser1._id,
        };

        Permission.findOne.mockResolvedValue(null);
        Permission.create.mockResolvedValue(mockNewPermission);

        const result = await Permission.grantPermission(
          mockItem._id,
          "Item",
          mockUser2._id,
          "view",
          mockUser1._id
        );

        expect(Permission.create).toHaveBeenCalledWith({
          resourceId: mockItem._id,
          resourceType: "Item",
          userId: mockUser2._id,
          accessLevel: "view",
          grantedBy: mockUser1._id,
          expiresAt: null,
        });
        expect(result).toBe(mockNewPermission);
      });

      it("should update existing permission", async () => {
        const mockExistingPermission = {
          resourceId: mockItem._id,
          resourceType: "Item",
          userId: mockUser2._id,
          accessLevel: "view",
          grantedBy: mockUser1._id,
          save: jest.fn().mockResolvedValue(true),
        };

        Permission.findOne.mockResolvedValue(mockExistingPermission);

        const result = await Permission.grantPermission(
          mockItem._id,
          "Item",
          mockUser2._id,
          "edit",
          mockUser1._id
        );

        expect(mockExistingPermission.accessLevel).toBe("edit");
        expect(mockExistingPermission.save).toHaveBeenCalled();
        expect(result).toBe(mockExistingPermission);
      });
    });

    describe("revokePermission", () => {
      it("should return true when permission is successfully deleted", async () => {
        Permission.deleteOne.mockResolvedValue({ deletedCount: 1 });

        const result = await Permission.revokePermission(
          mockItem._id,
          "Item",
          mockUser2._id
        );

        expect(result).toBe(true);
        expect(Permission.deleteOne).toHaveBeenCalledWith({
          resourceId: mockItem._id,
          resourceType: "Item",
          userId: mockUser2._id,
        });
      });

      it("should return false when no permission is deleted", async () => {
        Permission.deleteOne.mockResolvedValue({ deletedCount: 0 });

        const result = await Permission.revokePermission(
          mockItem._id,
          "Item",
          mockUser2._id
        );

        expect(result).toBe(false);
      });
    });
  });
});
