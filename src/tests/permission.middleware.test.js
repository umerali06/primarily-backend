const {
  checkPermission,
  checkItemPermission,
  checkFolderPermission,
  checkPermissionManagement,
  checkResourceOwnership,
  filterResourcesByPermission,
  getAccessibleResourceIds,
  addAccessibleResources,
} = require("../middleware/permission");
const Permission = require("../models/permission.model");
const Item = require("../models/item.model");
const Folder = require("../models/folder.model");
const CustomError = require("../utils/customError");

// Mock the models
jest.mock("../models/permission.model");
jest.mock("../models/item.model");
jest.mock("../models/folder.model");
jest.mock("../utils/customError");
jest.mock("../config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("Permission Middleware", () => {
  let req, res, next;
  const mockUserId = "user123";
  const mockResourceId = "resource123";

  beforeEach(() => {
    req = {
      user: { id: mockUserId },
      params: { id: mockResourceId },
    };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("checkPermission", () => {
    it("should allow access when user owns the resource", async () => {
      Item.findById = jest.fn().mockResolvedValue({
        _id: mockResourceId,
        userId: mockUserId,
      });

      const middleware = checkPermission("item", "view");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(Permission.hasPermission).not.toHaveBeenCalled();
    });

    it("should allow access when user has explicit permission", async () => {
      Item.findById = jest.fn().mockResolvedValue({
        _id: mockResourceId,
        userId: "otheruser",
      });
      Permission.hasPermission = jest.fn().mockResolvedValue(true);

      const middleware = checkPermission("item", "view");
      await middleware(req, res, next);

      expect(Permission.hasPermission).toHaveBeenCalledWith(
        mockUserId,
        mockResourceId,
        "Item",
        "view"
      );
      expect(next).toHaveBeenCalledWith();
    });

    it("should deny access when user has no permission", async () => {
      Item.findById = jest.fn().mockResolvedValue({
        _id: mockResourceId,
        userId: "otheruser",
      });
      Permission.hasPermission = jest.fn().mockResolvedValue(false);
      CustomError.mockImplementation((message, code) => ({ message, code }));

      const middleware = checkPermission("item", "view");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Insufficient permissions to access this resource",
          code: 403,
        })
      );
    });

    it("should return error when resource ID is missing", async () => {
      req.params.id = undefined;
      CustomError.mockImplementation((message, code) => ({ message, code }));

      const middleware = checkPermission("item", "view");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Resource ID is required",
          code: 400,
        })
      );
    });

    it("should handle errors gracefully", async () => {
      Item.findById = jest.fn().mockRejectedValue(new Error("Database error"));
      CustomError.mockImplementation((message, code) => ({ message, code }));

      const middleware = checkPermission("item", "view");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Error checking permissions",
          code: 500,
        })
      );
    });
  });

  describe("checkItemPermission", () => {
    it("should create middleware for item permissions", () => {
      const middleware = checkItemPermission("edit");
      expect(typeof middleware).toBe("function");
    });
  });

  describe("checkFolderPermission", () => {
    it("should create middleware for folder permissions", () => {
      const middleware = checkFolderPermission("admin");
      expect(typeof middleware).toBe("function");
    });
  });

  describe("checkPermissionManagement", () => {
    it("should allow permission management when user owns the resource", async () => {
      req.params.resourceId = mockResourceId;
      Item.findById = jest.fn().mockResolvedValue({
        _id: mockResourceId,
        userId: mockUserId,
      });

      const middleware = checkPermissionManagement("item");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it("should allow permission management when user has admin permission", async () => {
      req.params.resourceId = mockResourceId;
      Item.findById = jest.fn().mockResolvedValue({
        _id: mockResourceId,
        userId: "otheruser",
      });
      Permission.hasPermission = jest.fn().mockResolvedValue(true);

      const middleware = checkPermissionManagement("item");
      await middleware(req, res, next);

      expect(Permission.hasPermission).toHaveBeenCalledWith(
        mockUserId,
        mockResourceId,
        "Item",
        "admin"
      );
      expect(next).toHaveBeenCalledWith();
    });

    it("should deny permission management when user has insufficient rights", async () => {
      req.params.resourceId = mockResourceId;
      Item.findById = jest.fn().mockResolvedValue({
        _id: mockResourceId,
        userId: "otheruser",
      });
      Permission.hasPermission = jest.fn().mockResolvedValue(false);
      CustomError.mockImplementation((message, code) => ({ message, code }));

      const middleware = checkPermissionManagement("item");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            "Insufficient permissions to manage access for this resource",
          code: 403,
        })
      );
    });
  });

  describe("checkResourceOwnership", () => {
    it("should return true when user owns the item", async () => {
      Item.findById = jest.fn().mockResolvedValue({
        _id: mockResourceId,
        userId: mockUserId,
      });

      const result = await checkResourceOwnership(
        mockUserId,
        mockResourceId,
        "item"
      );
      expect(result).toBe(true);
    });

    it("should return true when user owns the folder", async () => {
      Folder.findById = jest.fn().mockResolvedValue({
        _id: mockResourceId,
        userId: mockUserId,
      });

      const result = await checkResourceOwnership(
        mockUserId,
        mockResourceId,
        "folder"
      );
      expect(result).toBe(true);
    });

    it("should return false when user does not own the resource", async () => {
      Item.findById = jest.fn().mockResolvedValue({
        _id: mockResourceId,
        userId: "otheruser",
      });

      const result = await checkResourceOwnership(
        mockUserId,
        mockResourceId,
        "item"
      );
      expect(result).toBe(false);
    });

    it("should return false when resource is not found", async () => {
      Item.findById = jest.fn().mockResolvedValue(null);

      const result = await checkResourceOwnership(
        mockUserId,
        mockResourceId,
        "item"
      );
      expect(result).toBe(false);
    });

    it("should return false on error", async () => {
      Item.findById = jest.fn().mockRejectedValue(new Error("Database error"));

      const result = await checkResourceOwnership(
        mockUserId,
        mockResourceId,
        "item"
      );
      expect(result).toBe(false);
    });
  });

  describe("filterResourcesByPermission", () => {
    it("should include owned resources", async () => {
      const resources = [
        { _id: "resource1", userId: mockUserId },
        { _id: "resource2", userId: "otheruser" },
      ];

      Permission.hasPermission = jest.fn().mockResolvedValue(false);

      const result = await filterResourcesByPermission(
        mockUserId,
        resources,
        "item"
      );
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("resource1");
    });

    it("should include resources with explicit permissions", async () => {
      const resources = [
        { _id: "resource1", userId: "otheruser" },
        { _id: "resource2", userId: "otheruser" },
      ];

      Permission.hasPermission = jest
        .fn()
        .mockResolvedValueOnce(true) // resource1 has permission
        .mockResolvedValueOnce(false); // resource2 has no permission

      const result = await filterResourcesByPermission(
        mockUserId,
        resources,
        "item"
      );
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("resource1");
    });
  });

  describe("getAccessibleResourceIds", () => {
    it("should return owned and permitted resource IDs for items", async () => {
      const ownedItems = [{ _id: "item1" }, { _id: "item2" }];
      const permissions = [
        { resourceId: "item3", accessLevel: "view" },
        { resourceId: "item4", accessLevel: "edit" },
      ];

      Item.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(ownedItems),
      });
      Permission.find = jest.fn().mockResolvedValue(permissions);

      const result = await getAccessibleResourceIds(mockUserId, "item");
      expect(result).toEqual(["item1", "item2", "item3", "item4"]);
    });

    it("should return owned and permitted resource IDs for folders", async () => {
      const ownedFolders = [{ _id: "folder1" }];
      const permissions = [{ resourceId: "folder2", accessLevel: "admin" }];

      Folder.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(ownedFolders),
      });
      Permission.find = jest.fn().mockResolvedValue(permissions);

      const result = await getAccessibleResourceIds(mockUserId, "folder");
      expect(result).toEqual(["folder1", "folder2"]);
    });

    it("should filter permissions by access level", async () => {
      const ownedItems = [];
      const permissions = [
        { resourceId: "item1", accessLevel: "view" },
        { resourceId: "item2", accessLevel: "edit" },
        { resourceId: "item3", accessLevel: "admin" },
      ];

      Item.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(ownedItems),
      });
      Permission.find = jest.fn().mockResolvedValue(permissions);

      const result = await getAccessibleResourceIds(mockUserId, "item", "edit");
      expect(result).toEqual(["item2", "item3"]); // Only edit and admin levels
    });

    it("should handle errors gracefully", async () => {
      Item.find = jest.fn().mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error("Database error")),
      });

      const result = await getAccessibleResourceIds(mockUserId, "item");
      expect(result).toEqual([]);
    });
  });

  describe("addAccessibleResources", () => {
    it("should add accessible resource IDs to request", async () => {
      const accessibleIds = ["resource1", "resource2"];

      // Mock getAccessibleResourceIds by mocking the functions it uses
      Item.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: "resource1" }]),
      });
      Permission.find = jest
        .fn()
        .mockResolvedValue([{ resourceId: "resource2", accessLevel: "view" }]);

      const middleware = addAccessibleResources("item");
      await middleware(req, res, next);

      expect(req.accessibleResourceIds).toEqual(["resource1", "resource2"]);
      expect(next).toHaveBeenCalledWith();
    });

    it("should handle errors gracefully", async () => {
      Item.find = jest.fn().mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error("Database error")),
      });
      CustomError.mockImplementation((message, code) => ({ message, code }));

      const middleware = addAccessibleResources("item");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Error determining accessible resources",
          code: 500,
        })
      );
    });
  });
});
