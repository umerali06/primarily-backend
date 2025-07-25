const mongoose = require("mongoose");
const Item = require("../models/item.model");
const itemController = require("../controllers/item.controller");
const ApiResponse = require("../utils/apiResponse");

// Mock dependencies
jest.mock("../models/item.model");
jest.mock("../utils/apiResponse");

describe("Item Search Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        id: "user123",
      },
      query: {},
    };
    res = {};
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();

    // Default mock implementations
    ApiResponse.success = jest.fn().mockReturnValue({});
  });

  describe("searchItems", () => {
    it("should perform basic text search", async () => {
      req.query = {
        q: "laptop",
        page: "1",
        limit: "10",
      };

      // Mock Item.find chain
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([
          { _id: "item1", name: "Gaming Laptop", quantity: 5 },
          { _id: "item2", name: "Business Laptop", quantity: 3 },
        ]),
      };
      Item.find.mockReturnValue(mockFind);
      Item.countDocuments.mockResolvedValue(2);
      Item.aggregate.mockResolvedValue([
        {
          totalValue: 2500,
          totalQuantity: 8,
          avgPrice: 1250,
          lowStockCount: 1,
        },
      ]);

      await itemController.searchItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        $or: [
          { name: { $regex: "laptop", $options: "i" } },
          { description: { $regex: "laptop", $options: "i" } },
          { tags: { $in: [expect.any(RegExp)] } },
        ],
      });

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Search completed successfully",
        expect.objectContaining({
          items: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 2,
            pages: 1,
          }),
          stats: expect.objectContaining({
            totalValue: 2500,
            totalQuantity: 8,
          }),
        })
      );
    });

    it("should filter by price range", async () => {
      req.query = {
        minPrice: "100",
        maxPrice: "500",
      };

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([]),
      };
      Item.find.mockReturnValue(mockFind);
      Item.countDocuments.mockResolvedValue(0);
      Item.aggregate.mockResolvedValue([]);

      await itemController.searchItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        price: {
          $gte: 100,
          $lte: 500,
        },
      });
    });

    it("should filter by quantity range", async () => {
      req.query = {
        minQuantity: "5",
        maxQuantity: "20",
      };

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([]),
      };
      Item.find.mockReturnValue(mockFind);
      Item.countDocuments.mockResolvedValue(0);
      Item.aggregate.mockResolvedValue([]);

      await itemController.searchItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        quantity: {
          $gte: 5,
          $lte: 20,
        },
      });
    });

    it("should filter by tags", async () => {
      req.query = {
        tags: "electronics,gadgets",
      };

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([]),
      };
      Item.find.mockReturnValue(mockFind);
      Item.countDocuments.mockResolvedValue(0);
      Item.aggregate.mockResolvedValue([]);

      await itemController.searchItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        tags: { $in: ["electronics", "gadgets"] },
      });
    });

    it("should filter by low stock", async () => {
      req.query = {
        lowStock: "true",
      };

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([]),
      };
      Item.find.mockReturnValue(mockFind);
      Item.countDocuments.mockResolvedValue(0);
      Item.aggregate.mockResolvedValue([]);

      await itemController.searchItems(req, res, next);

      expect(Item.find).toHaveBeenCalledWith({
        userId: "user123",
        $expr: { $lte: ["$quantity", "$minLevel"] },
      });
    });

    it("should sort by specified field and order", async () => {
      req.query = {
        sortBy: "name",
        sortOrder: "asc",
      };

      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([]),
      };
      Item.find.mockReturnValue(mockFind);
      Item.countDocuments.mockResolvedValue(0);
      Item.aggregate.mockResolvedValue([]);

      await itemController.searchItems(req, res, next);

      expect(mockFind.sort).toHaveBeenCalledWith({ name: 1 });
    });

    it("should handle errors", async () => {
      const error = new Error("Database error");
      Item.find.mockImplementation(() => {
        throw error;
      });

      await itemController.searchItems(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getItemStats", () => {
    it("should return item statistics", async () => {
      // Mock mongoose.Types.ObjectId
      mongoose.Types = {
        ObjectId: jest.fn().mockImplementation((id) => id),
      };

      // Mock aggregation results
      Item.aggregate
        .mockResolvedValueOnce([
          {
            totalItems: 25,
            totalValue: 5000,
            totalQuantity: 100,
            avgPrice: 200,
            avgQuantity: 4,
            lowStockCount: 3,
          },
        ])
        .mockResolvedValueOnce([
          {
            _id: "folder1",
            count: 10,
            totalValue: 2000,
            totalQuantity: 40,
            folderName: "Electronics",
          },
          {
            _id: "folder2",
            count: 8,
            totalValue: 1500,
            totalQuantity: 30,
            folderName: "Books",
          },
        ])
        .mockResolvedValueOnce([
          { _id: "electronics", count: 15 },
          { _id: "gadgets", count: 10 },
          { _id: "books", count: 8 },
        ]);

      await itemController.getItemStats(req, res, next);

      expect(Item.aggregate).toHaveBeenCalledTimes(3);
      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Statistics retrieved successfully",
        expect.objectContaining({
          basic: expect.objectContaining({
            totalItems: 25,
            totalValue: 5000,
            lowStockCount: 3,
          }),
          categories: expect.any(Array),
          topTags: expect.any(Array),
        })
      );
    });

    it("should handle empty results", async () => {
      mongoose.Types = {
        ObjectId: jest.fn().mockImplementation((id) => id),
      };

      Item.aggregate
        .mockResolvedValueOnce([]) // Basic stats
        .mockResolvedValueOnce([]) // Category stats
        .mockResolvedValueOnce([]); // Tag stats

      await itemController.getItemStats(req, res, next);

      expect(ApiResponse.success).toHaveBeenCalledWith(
        res,
        "Statistics retrieved successfully",
        expect.objectContaining({
          basic: expect.objectContaining({
            totalItems: 0,
            totalValue: 0,
            lowStockCount: 0,
          }),
          categories: [],
          topTags: [],
        })
      );
    });

    it("should handle errors", async () => {
      const error = new Error("Database error");
      mongoose.Types = {
        ObjectId: jest.fn().mockImplementation((id) => id),
      };
      Item.aggregate.mockRejectedValue(error);

      await itemController.getItemStats(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
