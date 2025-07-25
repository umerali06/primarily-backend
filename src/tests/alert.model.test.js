const mongoose = require("mongoose");
const Alert = require("../models/alert.model");
const User = require("../models/user.model");
const Item = require("../models/item.model");

describe("Alert Model", () => {
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
      quantity: 5,
      minLevel: 10,
      userId,
    });

    itemId = item._id;
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Item.deleteMany({});
    await Alert.deleteMany({});

    // Disconnect from the test database
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear the Alert collection before each test
    await Alert.deleteMany({});
  });

  it("should create a new alert", async () => {
    const alertData = {
      itemId,
      userId,
      type: "low_quantity",
      threshold: 10,
      currentValue: 5,
      message: "Item is below minimum level",
    };

    const alert = await Alert.create(alertData);

    expect(alert).toBeDefined();
    expect(alert.itemId.toString()).toBe(itemId.toString());
    expect(alert.userId.toString()).toBe(userId.toString());
    expect(alert.type).toBe(alertData.type);
    expect(alert.threshold).toBe(alertData.threshold);
    expect(alert.currentValue).toBe(alertData.currentValue);
    expect(alert.message).toBe(alertData.message);
    expect(alert.status).toBe("active");
  });

  it("should mark an alert as read", async () => {
    const alert = await Alert.create({
      itemId,
      userId,
      type: "low_quantity",
      threshold: 10,
      currentValue: 5,
    });

    expect(alert.status).toBe("active");
    expect(alert.readAt).toBeNull();

    await alert.markAsRead();

    expect(alert.status).toBe("read");
    expect(alert.readAt).toBeDefined();
  });

  it("should resolve an alert", async () => {
    const alert = await Alert.create({
      itemId,
      userId,
      type: "low_quantity",
      threshold: 10,
      currentValue: 5,
    });

    expect(alert.status).toBe("active");
    expect(alert.resolvedAt).toBeNull();

    await alert.resolve();

    expect(alert.status).toBe("resolved");
    expect(alert.resolvedAt).toBeDefined();
  });

  it("should create a low quantity alert", async () => {
    const item = {
      _id: itemId,
      userId,
      name: "Test Item",
      quantity: 5,
      minLevel: 10,
    };

    const alert = await Alert.createLowQuantityAlert(item);

    expect(alert).toBeDefined();
    expect(alert.itemId.toString()).toBe(itemId.toString());
    expect(alert.userId.toString()).toBe(userId.toString());
    expect(alert.type).toBe("low_quantity");
    expect(alert.threshold).toBe(item.minLevel);
    expect(alert.currentValue).toBe(item.quantity);
    expect(alert.status).toBe("active");
  });

  it("should update an existing low quantity alert", async () => {
    // Create initial alert
    await Alert.create({
      itemId,
      userId,
      type: "low_quantity",
      threshold: 10,
      currentValue: 8,
      status: "read",
      readAt: new Date(),
    });

    // Update with new values
    const item = {
      _id: itemId,
      userId,
      name: "Test Item",
      quantity: 5,
      minLevel: 12,
    };

    const alert = await Alert.createLowQuantityAlert(item);

    expect(alert).toBeDefined();
    expect(alert.threshold).toBe(item.minLevel);
    expect(alert.currentValue).toBe(item.quantity);
    expect(alert.status).toBe("active");
    expect(alert.readAt).toBeNull();
  });

  it("should check and resolve alerts when quantity is above min level", async () => {
    // Create alert
    const alert = await Alert.create({
      itemId,
      userId,
      type: "low_quantity",
      threshold: 10,
      currentValue: 5,
      status: "active",
    });

    // Item with quantity above min level
    const item = {
      _id: itemId,
      quantity: 15,
      minLevel: 10,
    };

    await Alert.checkAndResolveAlerts(item);

    // Reload alert
    const updatedAlert = await Alert.findById(alert._id);

    expect(updatedAlert.status).toBe("resolved");
    expect(updatedAlert.resolvedAt).toBeDefined();
  });
});
