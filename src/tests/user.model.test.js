const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");

// Mock config
jest.mock("../config", () => ({
  jwtSecret: "test-jwt-secret",
  jwtExpiresIn: "1h",
  jwtRefreshSecret: "test-refresh-secret",
  jwtRefreshExpiresIn: "7d",
}));

describe("User Model", () => {
  beforeAll(async () => {
    // Connect to a test database
    await mongoose.connect("mongodb://localhost:27017/test_db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    // Disconnect from the test database
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear the User collection before each test
    await User.deleteMany({});
  });

  it("should create a new user", async () => {
    const userData = {
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    };

    const user = await User.create(userData);

    expect(user).toBeDefined();
    expect(user.name).toBe(userData.name);
    expect(user.email).toBe(userData.email);
    expect(user.role).toBe("user"); // Default role
    expect(user.status).toBe("active"); // Default status
  });

  it("should hash the password before saving", async () => {
    const userData = {
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    };

    const user = await User.create(userData);

    // Password should be hashed
    expect(user.password).not.toBe(userData.password);

    // Should be able to compare passwords
    const isMatch = await bcrypt.compare(userData.password, user.password);
    expect(isMatch).toBe(true);
  });

  it("should not rehash the password if not modified", async () => {
    const userData = {
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    };

    const user = await User.create(userData);
    const originalPassword = user.password;

    // Update user without changing password
    user.name = "Updated Name";
    await user.save();

    // Password should remain the same
    expect(user.password).toBe(originalPassword);
  });

  it("should generate auth token", async () => {
    const userData = {
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    };

    const user = await User.create(userData);
    const token = user.generateAuthToken();

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
  });

  it("should generate refresh token", async () => {
    const userData = {
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    };

    const user = await User.create(userData);
    const refreshToken = user.generateRefreshToken();

    expect(refreshToken).toBeDefined();
    expect(typeof refreshToken).toBe("string");
  });

  it("should update last login", async () => {
    const userData = {
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    };

    const user = await User.create(userData);
    expect(user.lastLogin).toBeNull();

    await user.updateLastLogin();
    expect(user.lastLogin).toBeDefined();
  });

  it("should not allow duplicate emails", async () => {
    const userData = {
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    };

    await User.create(userData);

    // Try to create another user with the same email
    await expect(User.create(userData)).rejects.toThrow();
  });
});
