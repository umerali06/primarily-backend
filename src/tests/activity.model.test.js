const mongoose = require("mongoose");
const Activity = require("../models/activity.model");
const User = require("../models/user.model");
const Item = require("../models/item.model");

describe("Activity Model", () => {
  let userId, itemId;

  beforeAll(async () => {
    // Connect to a test database
    await mongoose.connect("mongodb://localhost:27017/test_db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Create a test user
    const user = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    userId = user._id;

    // Create a test item
    const item = await Item.create({
      name: "Test Item",
      quantity: 10,
      userId,
    });

    itemId = item._id;
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Item.deleteMany({});
    await Activity.deleteMany({});

    // Disconnect from the test database
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear the Activity collection before each test
    await Activity.deleteMany({});
  });

  it("should create a new activity", async () => {
    const activityData = {
      userId,
      resourceId: itemId,
      resourceType: "item",
      action: "create",
      details: { name: "Test Item" },
    };

    const activity = await Activity.create(activityData);

    expect(activity).toBeDefined();
    expect(activity.userId.toString()).toBe(userId.toString());
    expect(activity.resourceId.toString()).toBe(itemId.toString());
    expect(activity.resourceType).toBe(activityData.resourceType);
    expect(activity.action).toBe(activityData.action);
    expect(activity.details).toEqual(activityData.details);
  });

  it("should log item activity", async () => {
    const activity = await Activity.logItemActivity(userId, itemId, "update", {
      oldQuantity: 10,
      newQuantity: 15,
    });

    expect(activity).toBeDefined();
    expect(activity.userId.toString()).toBe(userId.toString());
    expect(activity.resourceId.toString()).toBe(itemId.toString());
    expect(activity.resourceType).toBe("item");
    expect(activity.action).toBe("update");
    expect(activity.details).toEqual({ oldQuantity: 10, newQuantity: 15 });
  });

  it("should log folder activity", async () => {
    const folderId = new mongoose.Types.ObjectId();

    const activity = await Activity.logFolderActivity(
      userId,
      folderId,
      "create",
      { name: "Test Folder" }
    );

    expect(activity).toBeDefined();
    expect(activity.userId.toString()).toBe(userId.toString());
    expect(activity.resourceId.toString()).toBe(folderId.toString());
    expect(activity.resourceType).toBe("folder");
    expect(activity.action).toBe("create");
    expect(activity.details).toEqual({ name: "Test Folder" });
  });

  it("should log user activity", async () => {
    const targetUserId = new mongoose.Types.ObjectId();

    const activity = await Activity.logUserActivity(
      userId,
      targetUserId,
      "update",
      { field: "name", oldValue: "Old Name", newValue: "New Name" }
    );

    expect(activity).toBeDefined();
    expect(activity.userId.toString()).toBe(userId.toString());
    expect(activity.resourceId.toString()).toBe(targetUserId.toString());
    expect(activity.resourceType).toBe("user");
    expect(activity.action).toBe("update");
    expect(activity.details).toEqual({
      field: "name",
      oldValue: "Old Name",
      newValue: "New Name",
    });
  });

  it("should log alert activity", async () => {
    const alertId = new mongoose.Types.ObjectId();

    const activity = await Activity.logAlertActivity(
      userId,
      alertId,
      "status_change",
      { oldStatus: "active", newStatus: "read" }
    );

    expect(activity).toBeDefined();
    expect(activity.userId.toString()).toBe(userId.toString());
    expect(activity.resourceId.toString()).toBe(alertId.toString());
    expect(activity.resourceType).toBe("alert");
    expect(activity.action).toBe("status_change");
    expect(activity.details).toEqual({
      oldStatus: "active",
      newStatus: "read",
    });
  });

  it("should log authentication activity", async () => {
    const mockReq = {
      ip: "127.0.0.1",
      headers: {
        "user-agent": "Mozilla/5.0 Test User Agent",
      },
    };

    const activity = await Activity.logAuthActivity(
      userId,
      "login",
      { method: "email" },
      mockReq
    );

    expect(activity).toBeDefined();
    expect(activity.userId.toString()).toBe(userId.toString());
    expect(activity.resourceId.toString()).toBe(userId.toString());
    expect(activity.resourceType).toBe("user");
    expect(activity.action).toBe("login");
    expect(activity.details).toEqual({ method: "email" });
    expect(activity.ipAddress).toBe("127.0.0.1");
    expect(activity.userAgent).toBe("Mozilla/5.0 Test User Agent");
  });

  it("should get recent activity for a user", async () => {
    // Create multiple activities
    await Activity.create({
      userId,
      resourceId: itemId,
      resourceType: "item",
      action: "create",
      details: { name: "Item 1" },
    });

    await Activity.create({
      userId,
      resourceId: itemId,
      resourceType: "item",
      action: "update",
      details: { name: "Item 1 Updated" },
    });

    await Activity.create({
      userId,
      resourceId: new mongoose.Types.ObjectId(),
      resourceType: "folder",
      action: "create",
      details: { name: "Folder 1" },
    });

    // Get recent activities
    const activities = await Activity.getRecentActivity(userId, 2);

    expect(activities).toBeDefined();
    expect(activities.length).toBe(2);
    expect(activities[0].action).toBe("create"); // Most recent first
    expect(activities[1].action).toBe("update");
  });

  it("should get activity for a specific resource", async () => {
    // Create activities for different resources
    await Activity.create({
      userId,
      resourceId: itemId,
      resourceType: "item",
      action: "create",
      details: { name: "Item 1" },
    });

    await Activity.create({
      userId,
      resourceId: itemId,
      resourceType: "item",
      action: "update",
      details: { name: "Item 1 Updated" },
    });

    await Activity.create({
      userId,
      resourceId: new mongoose.Types.ObjectId(),
      resourceType: "folder",
      action: "create",
      details: { name: "Folder 1" },
    });

    // Get activities for the item
    const activities = await Activity.getResourceActivity(itemId, "item");

    expect(activities).toBeDefined();
    expect(activities.length).toBe(2);
    expect(activities[0].resourceId.toString()).toBe(itemId.toString());
    expect(activities[1].resourceId.toString()).toBe(itemId.toString());
  });
});
