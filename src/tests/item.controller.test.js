const mongoose = require("mongoose");
const Item = require("../models/item.model");
const Activity = require("../models/activity.model");
const itemController = require("../controllers/item.controller");
const ApiResponse = require("../utils/apiResponse");
const { NotFoundError, BadRequestError } = require("../utils/customError");

// Mock dependencies
jest.mock("../models/item.model");
jest.mock("../models/activity.model");
jest.mock("../utils/apiResponse");

describe("Item Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        id: "user123",
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
    ApiResponse.created = jest.fn().mockReturnValue({});
  });

  describe("createItem", () => {
    beforeEach(() => {
      req.body = {
        name: "Test Item",
        description: "Test Description",
        quantity: 10,
        price: 19.99,
      };
    });

    it("should create an item successfully", async () => {
      // Mock created item
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        description: "Test Description",
        quantity: 10,
        price: 19.99,
        userId: "user123",
        folderId: null,
      };
      Item.create.mockResolvedValueOnce(mockItem);

      await itemController.createItem(req, res, next);

      expect(Item.create).toHaveBeenCalledWith({
        ...req.body,
        userId: "user123",
      });
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        resourceId: "item123",
        resourceType: "Item",
        action: "create",
        details: expect.objectContaining({
          name: "Test Item",
        }),
      });
      expect(ApiResponse.created).toHaveBeenCalledWith(
        res,
        "Item created successfully",
        { item: mockItem }
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.create.mockRejectedValueOnce(error);

      await itemController.createItem(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getItems", () => {
    it("should get items with default pagination", async () => {
      // Mock items
      const mockItems = [
        { _id: "item1", name: "Item 1" },
        { _id: "item2", name: "Item 2" },
      ];

      // Mock Item.find chain
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValueOnce(mockItems),
      };
      Item.find.mockReturnValueOnce(mockFind);
      Item.countDocuments.mockResolvedValueOnce(2);

      await itemController.getItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({ userId: "user123" });
      expect(mockFind.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockFind.skip).toHaveBeenCalledWith(0);
      expect(mockFind.limit).toHaveBeenCalledWith(20);
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Items retrieved successfully",
        expect.objectContaining({
          items: mockItems,
          pagination: expect.objectContaining({
            page: 1,
            limit: 20,
            total: 2,
            pages: 1,
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should filter items by folder", async () => {
      req.query.folderId = "folder123";

      // Mock Item.find chain
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValueOnce([]),
      };
      Item.find.mockReturnValueOnce(mockFind);
      Item.countDocuments.mockResolvedValueOnce(0);

      await itemController.getItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        folderId: "folder123",
      });
    });

    it("should filter items by null folder", async () => {
      req.query.folderId = "null";

      // Mock Item.find chain
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValueOnce([]),
      };
      Item.find.mockReturnValueOnce(mockFind);
      Item.countDocuments.mockResolvedValueOnce(0);

      await itemController.getItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        folderId: null,
      });
    });

    it("should filter items by search term", async () => {
      req.query.search = "test";

      // Mock Item.find chain
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValueOnce([]),
      };
      Item.find.mockReturnValueOnce(mockFind);
      Item.countDocuments.mockResolvedValueOnce(0);

      await itemController.getItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        $text: { $search: "test" },
      });
    });

    it("should filter items by tags", async () => {
      req.query.tags = "tag1,tag2";

      // Mock Item.find chain
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValueOnce([]),
      };
      Item.find.mockReturnValueOnce(mockFind);
      Item.countDocuments.mockResolvedValueOnce(0);

      await itemController.getItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        tags: { $in: ["tag1", "tag2"] },
      });
    });

    it("should filter items by low stock", async () => {
      req.query.lowStock = "true";

      // Mock Item.find chain
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValueOnce([]),
      };
      Item.find.mockReturnValueOnce(mockFind);
      Item.countDocuments.mockResolvedValueOnce(0);

      await itemController.getItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        $expr: { $lte: ["$quantity", "$minLevel"] },
      });
    });

    it("should sort items by specified field", async () => {
      req.query.sortBy = "name:asc";

      // Mock Item.find chain
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValueOnce([]),
      };
      Item.find.mockReturnValueOnce(mockFind);
      Item.countDocuments.mockResolvedValueOnce(0);

      await itemController.getItems(req, res, next);

      expect(mockFind.sort).toHaveBeenCalledWith({ name: 1 });
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.find.mockImplementationOnce(() => {
        throw error;
      });

      await itemController.getItems(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getItemById", () => {
    beforeEach(() => {
      req.params.id = "item123";
    });

    it("should get item by ID successfully", async () => {
      // Mock item
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        userId: "user123",
      };
      Item.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(mockItem),
      });

      await itemController.getItemById(req, res, next);

      expect(Item.findOne).toHaveBeenCalledWith({
        _id: "item123",
        userId: "user123",
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Item retrieved successfully",
        { item: mockItem }
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if item doesn't exist", async () => {
      // Mock item not found
      Item.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValueOnce(null),
      });

      await itemController.getItemById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.findOne.mockReturnValueOnce({
        populate: jest.fn().mockRejectedValueOnce(error),
      });

      await itemController.getItemById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateItem", () => {
    beforeEach(() => {
      req.params.id = "item123";
      req.body = {
        name: "Updated Item",
        description: "Updated Description",
      };
    });

    it("should update item successfully", async () => {
      // Mock existing item
      const mockExistingItem = {
        _id: "item123",
        name: "Test Item",
        description: "Test Description",
        userId: "user123",
      };
      Item.findOne.mockResolvedValueOnce(mockExistingItem);

      // Mock updated item
      const mockUpdatedItem = {
        _id: "item123",
        name: "Updated Item",
        description: "Updated Description",
        userId: "user123",
      };
      Item.findByIdAndUpdate.mockResolvedValueOnce(mockUpdatedItem);

      await itemController.updateItem(req, res, next);

      expect(Item.findOne).toHaveBeenCalledWith({
        _id: "item123",
        userId: "user123",
      });
      expect(Item.findByIdAndUpdate).toHaveBeenCalledWith(
        "item123",
        { $set: req.body },
        { new: true, runValidators: true }
      );
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        resourceId: "item123",
        resourceType: "Item",
        action: "update",
        details: {
          changes: {
            name: { from: "Test Item", to: "Updated Item" },
            description: {
              from: "Test Description",
              to: "Updated Description",
            },
          },
        },
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Item updated successfully",
        { item: mockUpdatedItem }
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should not log activity if no changes were made", async () => {
      // Mock existing item with same values as update
      const mockExistingItem = {
        _id: "item123",
        name: "Updated Item",
        description: "Updated Description",
        userId: "user123",
      };
      Item.findOne.mockResolvedValueOnce(mockExistingItem);

      // Mock updated item (same as existing)
      const mockUpdatedItem = {
        _id: "item123",
        name: "Updated Item",
        description: "Updated Description",
        userId: "user123",
      };
      Item.findByIdAndUpdate.mockResolvedValueOnce(mockUpdatedItem);

      await itemController.updateItem(req, res, next);

      expect(Activity.create).not.toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalled();
    });

    it("should return error if item doesn't exist", async () => {
      // Mock item not found
      Item.findOne.mockResolvedValueOnce(null);

      await itemController.updateItem(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.findOne.mockRejectedValueOnce(error);

      await itemController.updateItem(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteItem", () => {
    beforeEach(() => {
      req.params.id = "item123";
    });

    it("should delete item successfully", async () => {
      // Mock item
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        userId: "user123",
        folderId: "folder123",
        deleteOne: jest.fn().mockResolvedValueOnce({}),
      };
      Item.findOne.mockResolvedValueOnce(mockItem);

      await itemController.deleteItem(req, res, next);

      expect(Item.findOne).toHaveBeenCalledWith({
        _id: "item123",
        userId: "user123",
      });
      expect(mockItem.deleteOne).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        resourceId: "item123",
        resourceType: "Item",
        action: "delete",
        details: expect.objectContaining({
          name: "Test Item",
          folderId: "folder123",
        }),
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Item deleted successfully"
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if item doesn't exist", async () => {
      // Mock item not found
      Item.findOne.mockResolvedValueOnce(null);

      await itemController.deleteItem(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.findOne.mockRejectedValueOnce(error);

      await itemController.deleteItem(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateQuantity", () => {
    beforeEach(() => {
      req.params.id = "item123";
      req.body = {
        change: 5,
        reason: "Restock",
      };
    });

    it("should update quantity successfully", async () => {
      // Mock item
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        quantity: 10,
        updateQuantity: jest.fn().mockResolvedValueOnce({
          previousQuantity: 10,
          newQuantity: 15,
          change: 5,
        }),
      };
      Item.findOne.mockResolvedValueOnce(mockItem);

      await itemController.updateQuantity(req, res, next);

      expect(Item.findOne).toHaveBeenCalledWith({
        _id: "item123",
        userId: "user123",
      });
      expect(mockItem.updateQuantity).toHaveBeenCalledWith(5, "Restock");
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Item quantity updated successfully",
        expect.objectContaining({
          item: mockItem,
          quantityChange: expect.objectContaining({
            previousQuantity: 10,
            newQuantity: 15,
            change: 5,
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if change is not provided", async () => {
      req.body = {};

      await itemController.updateQuantity(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe(
        "Quantity change is required and must be a number"
      );
    });

    it("should return error if item doesn't exist", async () => {
      // Mock item not found
      Item.findOne.mockResolvedValueOnce(null);

      await itemController.updateQuantity(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should handle updateQuantity errors", async () => {
      // Mock item with updateQuantity error
      const mockItem = {
        updateQuantity: jest
          .fn()
          .mockRejectedValueOnce(new Error("Invalid quantity")),
      };
      Item.findOne.mockResolvedValueOnce(mockItem);

      await itemController.updateQuantity(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it("should handle general errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.findOne.mockRejectedValueOnce(error);

      await itemController.updateQuantity(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("addItemImage", () => {
    beforeEach(() => {
      req.params.id = "item123";
      req.body = {
        imageUrl: "https://example.com/image.jpg",
      };
    });

    it("should add image successfully", async () => {
      // Mock item
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        images: [],
        save: jest.fn().mockResolvedValueOnce({}),
      };
      Item.findOne.mockResolvedValueOnce(mockItem);

      await itemController.addItemImage(req, res, next);

      expect(Item.findOne).toHaveBeenCalledWith({
        _id: "item123",
        userId: "user123",
      });
      expect(mockItem.images).toContain("https://example.com/image.jpg");
      expect(mockItem.save).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        resourceId: "item123",
        resourceType: "Item",
        action: "add_image",
        details: expect.objectContaining({
          name: "Test Item",
          imageUrl: "https://example.com/image.jpg",
        }),
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Image added successfully",
        expect.objectContaining({
          item: mockItem,
          imageUrl: "https://example.com/image.jpg",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should generate placeholder URL if imageUrl not provided", async () => {
      req.body = {};

      // Mock item
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        images: [],
        save: jest.fn().mockResolvedValueOnce({}),
      };
      Item.findOne.mockResolvedValueOnce(mockItem);

      await itemController.addItemImage(req, res, next);

      expect(mockItem.images[0]).toMatch(
        /^https:\/\/example\.com\/placeholder-\d+\.jpg$/
      );
      expect(mockItem.save).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalled();
    });

    it("should return error if item doesn't exist", async () => {
      // Mock item not found
      Item.findOne.mockResolvedValueOnce(null);

      await itemController.addItemImage(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.findOne.mockRejectedValueOnce(error);

      await itemController.addItemImage(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("removeItemImage", () => {
    beforeEach(() => {
      req.params.id = "item123";
      req.params.imageIndex = "0";
    });

    it("should remove image successfully", async () => {
      // Mock item
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        images: [
          "https://example.com/image.jpg",
          "https://example.com/image2.jpg",
        ],
        save: jest.fn().mockResolvedValueOnce({}),
      };
      Item.findOne.mockResolvedValueOnce(mockItem);

      await itemController.removeItemImage(req, res, next);

      expect(Item.findOne).toHaveBeenCalledWith({
        _id: "item123",
        userId: "user123",
      });
      expect(mockItem.images).toHaveLength(1);
      expect(mockItem.images[0]).toBe("https://example.com/image2.jpg");
      expect(mockItem.save).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        resourceId: "item123",
        resourceType: "Item",
        action: "remove_image",
        details: expect.objectContaining({
          name: "Test Item",
          imageUrl: "https://example.com/image.jpg",
        }),
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Image removed successfully",
        expect.objectContaining({
          item: mockItem,
          removedImage: "https://example.com/image.jpg",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if item doesn't exist", async () => {
      // Mock item not found
      Item.findOne.mockResolvedValueOnce(null);

      await itemController.removeItemImage(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should return error if image doesn't exist", async () => {
      // Mock item with no images
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        images: [],
      };
      Item.findOne.mockResolvedValueOnce(mockItem);

      await itemController.removeItemImage(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Image not found");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.findOne.mockRejectedValueOnce(error);

      await itemController.removeItemImage(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("moveItem", () => {
    beforeEach(() => {
      req.params.id = "item123";
      req.body = {
        folderId: "folder456",
      };
    });

    it("should move item successfully", async () => {
      // Mock item
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        folderId: "folder123",
        save: jest.fn().mockResolvedValueOnce({}),
      };
      Item.findOne.mockResolvedValueOnce(mockItem);

      await itemController.moveItem(req, res, next);

      expect(Item.findOne).toHaveBeenCalledWith({
        _id: "item123",
        userId: "user123",
      });
      expect(mockItem.folderId).toBe("folder456");
      expect(mockItem.save).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        resourceId: "item123",
        resourceType: "Item",
        action: "move",
        details: expect.objectContaining({
          name: "Test Item",
          from: "folder123",
          to: "folder456",
        }),
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Item moved successfully",
        { item: mockItem }
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should move item to null folder", async () => {
      req.body.folderId = "null";

      // Mock item
      const mockItem = {
        _id: "item123",
        name: "Test Item",
        folderId: "folder123",
        save: jest.fn().mockResolvedValueOnce({}),
      };
      Item.findOne.mockResolvedValueOnce(mockItem);

      await itemController.moveItem(req, res, next);

      expect(mockItem.folderId).toBeNull();
      expect(mockItem.save).toHaveBeenCalled();
      expect(Activity.create).toHaveBeenCalled();
      expect(ApiResponse.success).toHaveBeenCalled();
    });

    it("should return error if item doesn't exist", async () => {
      // Mock item not found
      Item.findOne.mockResolvedValueOnce(null);

      await itemController.moveItem(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toBe("Item not found");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.findOne.mockRejectedValueOnce(error);

      await itemController.moveItem(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("bulkUpdateItems", () => {
    beforeEach(() => {
      req.body = {
        itemIds: ["item1", "item2", "item3"],
        updates: {
          tags: ["bulk", "updated"],
          folderId: "folder456",
        },
      };
    });

    it("should bulk update items successfully", async () => {
      // Mock update result
      const mockResult = {
        matchedCount: 3,
        modifiedCount: 3,
      };
      Item.updateMany.mockResolvedValueOnce(mockResult);

      await itemController.bulkUpdateItems(req, res, next);

      expect(Item.updateMany).toHaveBeenCalledWith(
        {
          _id: { $in: ["item1", "item2", "item3"] },
          userId: "user123",
        },
        { $set: { tags: ["bulk", "updated"], folderId: "folder456" } },
        { runValidators: true }
      );
      expect(Activity.create).toHaveBeenCalledWith({
        userId: "user123",
        action: "bulk_update",
        details: expect.objectContaining({
          itemIds: ["item1", "item2", "item3"],
          updates: { tags: ["bulk", "updated"], folderId: "folder456" },
          matchedCount: 3,
          modifiedCount: 3,
        }),
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Items updated successfully",
        expect.objectContaining({
          matchedCount: 3,
          modifiedCount: 3,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return error if itemIds are not provided", async () => {
      req.body = {
        updates: {
          tags: ["bulk", "updated"],
        },
      };

      await itemController.bulkUpdateItems(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Item IDs are required");
    });

    it("should return error if updates are not provided", async () => {
      req.body = {
        itemIds: ["item1", "item2", "item3"],
      };

      await itemController.bulkUpdateItems(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe("Updates are required");
    });

    it("should handle errors", async () => {
      // Mock error
      const error = new Error("Database error");
      Item.updateMany.mockRejectedValueOnce(error);

      await itemController.bulkUpdateItems(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
