const request = require("supertest");
const fs = require("fs");
const path = require("path");
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
jest.mock("fs");

describe("Import Controller", () => {
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

  describe("POST /api/import/items/csv", () => {
    it("should import items from CSV successfully", async () => {
      const csvContent =
        "name,description,quantity,unit,price\nTest Item,Description,10,pcs,25.99";

      // Mock file operations
      fs.createReadStream = jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          on: jest.fn((event, callback) => {
            if (event === "data") {
              callback({
                name: "Test Item",
                description: "Description",
                quantity: "10",
                unit: "pcs",
                price: "25.99",
              });
            } else if (event === "end") {
              callback();
            }
            return { on: jest.fn() };
          }),
        }),
      });

      fs.unlinkSync = jest.fn();

      // Mock database operations
      Item.findOne.mockResolvedValue(null); // No existing item
      Item.create.mockResolvedValue({
        _id: "item123",
        name: "Test Item",
        quantity: 10,
        price: 25.99,
      });

      const response = await request(app)
        .post("/api/import/items/csv")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(csvContent), "test.csv")
        .field("duplicateAction", "skip")
        .expect(200);

      expect(response.body.data.summary.processed).toBe(1);
      expect(response.body.data.summary.created).toBe(1);
      expect(response.body.data.summary.errors).toBe(0);
    });

    it("should handle duplicate items based on action", async () => {
      const csvContent =
        "name,description,quantity\nExisting Item,Description,10";

      // Mock file operations
      fs.createReadStream = jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          on: jest.fn((event, callback) => {
            if (event === "data") {
              callback({
                name: "Existing Item",
                description: "Description",
                quantity: "10",
              });
            } else if (event === "end") {
              callback();
            }
            return { on: jest.fn() };
          }),
        }),
      });

      fs.unlinkSync = jest.fn();

      // Mock existing item
      const existingItem = {
        _id: "item123",
        name: "Existing Item",
        save: jest.fn().mockResolvedValue({}),
      };
      Item.findOne.mockResolvedValue(existingItem);

      const response = await request(app)
        .post("/api/import/items/csv")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(csvContent), "test.csv")
        .field("duplicateAction", "update")
        .expect(200);

      expect(response.body.data.summary.updated).toBe(1);
      expect(existingItem.save).toHaveBeenCalled();
    });

    it("should validate required fields", async () => {
      const csvContent = "name,description\n,Missing Name";

      // Mock file operations
      fs.createReadStream = jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          on: jest.fn((event, callback) => {
            if (event === "data") {
              callback({
                name: "",
                description: "Missing Name",
              });
            } else if (event === "end") {
              callback();
            }
            return { on: jest.fn() };
          }),
        }),
      });

      fs.unlinkSync = jest.fn();

      const response = await request(app)
        .post("/api/import/items/csv")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(csvContent), "test.csv")
        .expect(200);

      expect(response.body.data.errors).toHaveLength(1);
      expect(response.body.data.errors[0].error).toBe("Name is required");
    });
  });

  describe("POST /api/import/complete", () => {
    it("should import complete inventory from JSON", async () => {
      const jsonData = {
        folders: [
          {
            id: "folder1",
            name: "Test Folder",
            description: "Test Description",
          },
        ],
        items: [
          {
            id: "item1",
            name: "Test Item",
            quantity: 10,
            folderId: "folder1",
          },
        ],
      };

      // Mock file operations
      fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(jsonData));
      fs.unlinkSync = jest.fn();

      // Mock database operations
      Folder.findOne.mockResolvedValue(null);
      Folder.create.mockResolvedValue([
        {
          _id: "newfolder1",
          name: "Test Folder",
        },
      ]);

      Item.findOne.mockResolvedValue(null);
      Item.create.mockResolvedValue([
        {
          _id: "newitem1",
          name: "Test Item",
        },
      ]);

      const response = await request(app)
        .post("/api/import/complete")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(JSON.stringify(jsonData)), "test.json")
        .field("duplicateAction", "skip")
        .expect(200);

      expect(response.body.data.results.folders.created).toBe(1);
      expect(response.body.data.results.items.created).toBe(1);
    });

    it("should handle invalid JSON format", async () => {
      const invalidJson = "{ invalid json }";

      // Mock file operations
      fs.readFileSync = jest.fn().mockImplementation(() => {
        throw new SyntaxError("Unexpected token");
      });
      fs.unlinkSync = jest.fn();

      await request(app)
        .post("/api/import/complete")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(invalidJson), "test.json")
        .expect(400);
    });
  });

  describe("POST /api/import/validate", () => {
    it("should validate CSV file format", async () => {
      const csvContent = "name,description,quantity\nTest Item,Description,10";

      // Mock file operations
      fs.createReadStream = jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          on: jest.fn((event, callback) => {
            if (event === "data") {
              callback({
                name: "Test Item",
                description: "Description",
                quantity: "10",
              });
            } else if (event === "end") {
              callback();
            }
            return { on: jest.fn() };
          }),
        }),
      });

      fs.unlinkSync = jest.fn();

      const response = await request(app)
        .post("/api/import/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(csvContent), "test.csv")
        .field("type", "csv")
        .expect(200);

      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.preview).toHaveLength(1);
    });

    it("should validate JSON file format", async () => {
      const jsonData = {
        folders: [],
        items: [{ name: "Test Item" }],
      };

      // Mock file operations
      fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(jsonData));
      fs.unlinkSync = jest.fn();

      const response = await request(app)
        .post("/api/import/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(JSON.stringify(jsonData)), "test.json")
        .field("type", "json")
        .expect(200);

      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.preview.items).toHaveLength(1);
    });

    it("should detect missing required columns in CSV", async () => {
      const csvContent = "description,quantity\nDescription,10";

      // Mock file operations
      fs.createReadStream = jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          on: jest.fn((event, callback) => {
            if (event === "data") {
              callback({
                description: "Description",
                quantity: "10",
              });
            } else if (event === "end") {
              callback();
            }
            return { on: jest.fn() };
          }),
        }),
      });

      fs.unlinkSync = jest.fn();

      const response = await request(app)
        .post("/api/import/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from(csvContent), "test.csv")
        .field("type", "csv")
        .expect(200);

      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.errors).toContain(
        "Missing required column: name"
      );
    });
  });
});
