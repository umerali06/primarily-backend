const request = require("supertest");
const mongoose = require("mongoose");
const { app, server } = require("../../index");
const User = require("../../models/user.model");
const Item = require("../../models/item.model");
const Folder = require("../../models/folder.model");

describe("API Integration Tests", () => {
  let authToken;
  let testUser;
  let testFolder;
  let testItem;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_TEST_URI ||
          "mongodb://localhost:27017/inventory_test"
      );
    }
  });

  afterAll(async () => {
    // Clean up and close connections
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});
    await Item.deleteMany({});
    await Folder.deleteMany({});

    // Create test user
    testUser = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    // Login to get auth token
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "password123",
    });

    authToken = loginResponse.body.data.token;
  });

  describe("Authentication Flow", () => {
    it("should register, login, and access protected routes", async () => {
      // Register new user
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          name: "New User",
          email: "newuser@example.com",
          password: "password123",
        })
        .expect(201);

      expect(registerResponse.body.data.user.email).toBe("newuser@example.com");

      // Login with new user
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: "newuser@example.com",
          password: "password123",
        })
        .expect(200);

      const newUserToken = loginResponse.body.data.token;

      // Access protected route
      await request(app)
        .get("/api/users/profile")
        .set("Authorization", `Bearer ${newUserToken}`)
        .expect(200);
    });

    it("should handle invalid credentials", async () => {
      await request(app)
        .post("/api/auth/login")
        .send({
          email: "test@example.com",
          password: "wrongpassword",
        })
        .expect(401);
    });
  });

  describe("Folder Management Flow", () => {
    it("should create, read, update, and delete folders", async () => {
      // Create folder
      const createResponse = await request(app)
        .post("/api/folders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Electronics",
          description: "Electronic devices",
        })
        .expect(201);

      testFolder = createResponse.body.data.folder;
      expect(testFolder.name).toBe("Electronics");

      // Read folder
      const readResponse = await request(app)
        .get(`/api/folders/${testFolder._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(readResponse.body.data.folder.name).toBe("Electronics");

      // Update folder
      const updateResponse = await request(app)
        .put(`/api/folders/${testFolder._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Updated Electronics",
          description: "Updated description",
        })
        .expect(200);

      expect(updateResponse.body.data.folder.name).toBe("Updated Electronics");

      // Delete folder
      await request(app)
        .delete(`/api/folders/${testFolder._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/folders/${testFolder._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    it("should handle folder hierarchy", async () => {
      // Create parent folder
      const parentResponse = await request(app)
        .post("/api/folders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Parent Folder",
        })
        .expect(201);

      const parentFolder = parentResponse.body.data.folder;

      // Create child folder
      const childResponse = await request(app)
        .post("/api/folders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Child Folder",
          parentId: parentFolder._id,
        })
        .expect(201);

      const childFolder = childResponse.body.data.folder;
      expect(childFolder.parentId).toBe(parentFolder._id);

      // Get folder hierarchy
      const hierarchyResponse = await request(app)
        .get("/api/folders/hierarchy")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(hierarchyResponse.body.data.hierarchy).toHaveLength(1);
      expect(hierarchyResponse.body.data.hierarchy[0].children).toHaveLength(1);
    });
  });

  describe("Item Management Flow", () => {
    beforeEach(async () => {
      // Create test folder
      const folderResponse = await request(app)
        .post("/api/folders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Test Folder",
        });
      testFolder = folderResponse.body.data.folder;
    });

    it("should create, read, update, and delete items", async () => {
      // Create item
      const createResponse = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Test Item",
          description: "A test item",
          quantity: 10,
          unit: "pcs",
          minLevel: 5,
          price: 25.99,
          folderId: testFolder._id,
          tags: ["test", "item"],
        })
        .expect(201);

      testItem = createResponse.body.data.item;
      expect(testItem.name).toBe("Test Item");
      expect(testItem.quantity).toBe(10);

      // Read item
      const readResponse = await request(app)
        .get(`/api/items/${testItem._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(readResponse.body.data.item.name).toBe("Test Item");

      // Update item
      const updateResponse = await request(app)
        .put(`/api/items/${testItem._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Updated Test Item",
          quantity: 15,
        })
        .expect(200);

      expect(updateResponse.body.data.item.name).toBe("Updated Test Item");
      expect(updateResponse.body.data.item.quantity).toBe(15);

      // Update quantity
      await request(app)
        .put(`/api/items/${testItem._id}/quantity`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          change: -5,
          reason: "sold",
        })
        .expect(200);

      // Delete item
      await request(app)
        .delete(`/api/items/${testItem._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/items/${testItem._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    it("should search and filter items", async () => {
      // Create multiple items
      await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Laptop",
          tags: ["electronics", "computer"],
          quantity: 5,
          price: 999.99,
        });

      await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Mouse",
          tags: ["electronics", "accessory"],
          quantity: 20,
          price: 29.99,
        });

      // Search items
      const searchResponse = await request(app)
        .get("/api/items/search?q=laptop")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(searchResponse.body.data.items).toHaveLength(1);
      expect(searchResponse.body.data.items[0].name).toBe("Laptop");

      // Filter by tags
      const filterResponse = await request(app)
        .get("/api/items?tags=electronics")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(filterResponse.body.data.items).toHaveLength(2);
    });
  });

  describe("Alert System Flow", () => {
    beforeEach(async () => {
      // Create item with low stock
      const itemResponse = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Low Stock Item",
          quantity: 2,
          minLevel: 5,
        });
      testItem = itemResponse.body.data.item;
    });

    it("should generate and manage alerts", async () => {
      // Get alerts (should include low stock alert)
      const alertsResponse = await request(app)
        .get("/api/alerts")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(alertsResponse.body.data.alerts.length).toBeGreaterThan(0);

      const alert = alertsResponse.body.data.alerts[0];

      // Mark alert as read
      await request(app)
        .put(`/api/alerts/${alert._id}/status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ status: "read" })
        .expect(200);

      // Resolve alert
      await request(app)
        .put(`/api/alerts/${alert._id}/status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ status: "resolved" })
        .expect(200);
    });
  });

  describe("Activity Tracking", () => {
    it("should track user activities", async () => {
      // Perform some actions
      await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Activity Test Item",
          quantity: 10,
        });

      // Get activities
      const activitiesResponse = await request(app)
        .get("/api/activities")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(activitiesResponse.body.data.activities.length).toBeGreaterThan(0);

      const createActivity = activitiesResponse.body.data.activities.find(
        (activity) => activity.action === "create"
      );
      expect(createActivity).toBeDefined();
    });
  });

  describe("Export/Import Flow", () => {
    beforeEach(async () => {
      // Create test data
      await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Export Test Item",
          quantity: 10,
          price: 25.99,
        });
    });

    it("should export items to CSV", async () => {
      const response = await request(app)
        .get("/api/export/items/csv")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.text).toContain("Export Test Item");
    });

    it("should export items to JSON", async () => {
      const response = await request(app)
        .get("/api/export/items/json")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe("Export Test Item");
    });
  });

  describe("Permission System", () => {
    let secondUser;
    let secondUserToken;

    beforeEach(async () => {
      // Create second user
      secondUser = await User.create({
        name: "Second User",
        email: "second@example.com",
        password: "password123",
      });

      const loginResponse = await request(app).post("/api/auth/login").send({
        email: "second@example.com",
        password: "password123",
      });

      secondUserToken = loginResponse.body.data.token;

      // Create test item
      const itemResponse = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Permission Test Item",
          quantity: 10,
        });
      testItem = itemResponse.body.data.item;
    });

    it("should handle permission-based access", async () => {
      // Second user should not be able to access first user's item
      await request(app)
        .get(`/api/items/${testItem._id}`)
        .set("Authorization", `Bearer ${secondUserToken}`)
        .expect(403);

      // Grant permission to second user
      await request(app)
        .post("/api/permissions")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          resourceType: "Item",
          resourceId: testItem._id,
          userId: secondUser._id,
          accessLevel: "view",
        })
        .expect(201);

      // Second user should now be able to view the item
      await request(app)
        .get(`/api/items/${testItem._id}`)
        .set("Authorization", `Bearer ${secondUserToken}`)
        .expect(200);

      // But not edit it
      await request(app)
        .put(`/api/items/${testItem._id}`)
        .set("Authorization", `Bearer ${secondUserToken}`)
        .send({ name: "Updated Name" })
        .expect(403);
    });
  });
});
