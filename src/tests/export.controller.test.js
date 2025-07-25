const request = require("supertest");
const { app } = require("../index");
const Item = require("../models/item.model");
const Folder = require("../models/folder.model");
const User = require("../models/user.model");

// Mock dependencies
jest.mock("../models/item.model");
jest.mock("../models/folder.model");
jest.mock("../models/user.model");
jest.mock("../models/activity.model", () => ({
  create: jest.fn().mockResolvedValue({}),
}));

describe("Export Controller", () => {
  let authToken;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      id: "user123",
      name: "Test User",
      email: "test@example.com",
    };

    // Mock JWT token
    authToken = "mock-jwt-token";
  });

  describe("GET /api/export/items/csv", () => {
    it("should export items to CSV format", async () => {
      const mockItems = [
        {
          name: "Test Item 1",
          description: "Description 1",
          quantity: 10,
          unit: "pcs",
          minLevel: 5,
          price: 25.5,
          tags: ["tag1", "tag2"],
          folderId: { name: "Test Folder" },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Test Item 2",
          description: "Description 2",
          quantity: 20,
          unit: "kg",
          minLevel: 10,
          price: 15.75,
          tags: ["tag3"],
          folderId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      Item.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockItems),
        }),
      });

      const response = await request(app)
        .get("/api/export/items/csv")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.text).toContain("Test Item 1");
      expect(response.text).toContain("Test Item 2");
    });

    it("should apply filters when provided", async () => {
      Item.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([]),
        }),
      });

      await request(app)
        .get(
          "/api/export/items/csv?folderId=folder123&tags=tag1,tag2&lowStock=true"
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Item.find).toHaveBeenCalledWith({
        userId: mockUser.id,
        folderId: "folder123",
        tags: { $in: ["tag1", "tag2"] },
        $expr: { $lte: ["$quantity", "$minLevel"] },
      });
    });
  });

  describe("GET /api/export/items/json", () => {
    it("should export items to JSON format", async () => {
      const mockItems = [
        {
          name: "Test Item",
          description: "Description",
          quantity: 10,
          unit: "pcs",
          minLevel: 5,
          price: 25.5,
          tags: ["tag1"],
          images: ["image1.jpg"],
          folderId: { name: "Test Folder" },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      Item.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockItems),
        }),
      });

      const response = await request(app)
        .get("/api/export/items/json")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe("Test Item");
    });
  });

  describe("GET /api/export/complete", () => {
    it("should export complete inventory", async () => {
      const mockFolders = [
        {
          _id: "folder1",
          name: "Folder 1",
          description: "Description",
          parentId: null,
          level: 0,
          path: "/Folder 1",
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockItems = [
        {
          _id: "item1",
          name: "Item 1",
          quantity: 10,
          price: 25.5,
          folderId: { _id: "folder1", name: "Folder 1" },
          tags: [],
          images: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      Folder.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockFolders),
      });

      Item.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockItems),
        }),
      });

      const response = await request(app)
        .get("/api/export/complete")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.folders).toHaveLength(1);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.summary.totalFolders).toBe(1);
      expect(response.body.summary.totalItems).toBe(1);
      expect(response.body.summary.totalValue).toBe(255); // 10 * 25.50
    });
  });
});
