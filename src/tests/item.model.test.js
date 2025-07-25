const mongoose = require("mongoose");
const Item = require("../models/item.model");
const User = require("../models/user.model");

describe("Item Model", () => {
  let userId;

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
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Item.deleteMany({});

    // Disconnect from the test database
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear the Item collection before each test
    await Item.deleteMany({});
  });

  it("should create a new item", async () => {
    const itemData = {
      name: "Test Item",
      description: "This is a test item",
      quantity: 10,
      unit: "pcs",
      price: 19.99,
      userId,
    };

    const item = await Item.create(itemData);

    expect(item).toBeDefined();
    expect(item.name).toBe(itemData.name);
    expect(item.description).toBe(itemData.description);
    expect(item.quantity).toBe(itemData.quantity);
    expect(item.unit).toBe(itemData.unit);
    expect(item.price).toBe(itemData.price);
    expect(item.userId.toString()).toBe(userId.toString());
  });

  it("should calculate value correctly", async () => {
    const itemData = {
      name: "Test Item",
      quantity: 5,
      price: 10,
      userId,
    };

    const item = await Item.create(itemData);

    // Value should be quantity * price
    expect(item.value).toBe(50);
  });

  it("should detect low stock correctly", async () => {
    const itemData = {
      name: "Test Item",
      quantity: 5,
      minLevel: 10,
      userId,
    };

    const item = await Item.create(itemData);

    // Item is below min level
    expect(item.isLowStock()).toBe(true);

    // Update quantity to be above min level
    item.quantity = 15;
    expect(item.isLowStock()).toBe(false);
  });

  it("should update quantity correctly", async () => {
    const itemData = {
      name: "Test Item",
      quantity: 10,
      userId,
    };

    const item = await Item.create(itemData);

    // Increase quantity
    await item.updateQuantity(5);
    expect(item.quantity).toBe(15);

    // Decrease quantity
    await item.updateQuantity(-3);
    expect(item.quantity).toBe(12);
  });

  it("should not allow negative quantity", async () => {
    const itemData = {
      name: "Test Item",
      quantity: 10,
      userId,
    };

    const item = await Item.create(itemData);

    // Try to decrease quantity below zero
    await expect(item.updateQuantity(-15)).rejects.toThrow(
      "Cannot reduce quantity below zero"
    );

    // Quantity should remain unchanged
    expect(item.quantity).toBe(10);
  });

  it("should require a name", async () => {
    const itemData = {
      description: "This is a test item",
      quantity: 10,
      userId,
    };

    await expect(Item.create(itemData)).rejects.toThrow();
  });

  it("should require a user ID", async () => {
    const itemData = {
      name: "Test Item",
      description: "This is a test item",
      quantity: 10,
    };

    await expect(Item.create(itemData)).rejects.toThrow();
  });

  it("should handle variants correctly", async () => {
    const itemData = {
      name: "Test Item",
      hasVariants: true,
      variants: [
        {
          name: "Small",
          quantity: 5,
          attributes: { size: "S", color: "Red" },
        },
        {
          name: "Medium",
          quantity: 10,
          attributes: { size: "M", color: "Blue" },
        },
      ],
      userId,
    };

    const item = await Item.create(itemData);

    expect(item.hasVariants).toBe(true);
    expect(item.variants.length).toBe(2);
    expect(item.variants[0].name).toBe("Small");
    expect(item.variants[0].quantity).toBe(5);
    expect(item.variants[0].attributes.get("size")).toBe("S");
    expect(item.variants[1].name).toBe("Medium");
  });
});
