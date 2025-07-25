const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user.model");

// Mock dependencies
jest.mock("passport");
jest.mock("passport-google-oauth20", () => ({
  Strategy: jest.fn(),
}));
jest.mock("../models/user.model");
jest.mock("../models/activity.model", () => ({
  logUserActivity: jest.fn().mockResolvedValue({}),
  logAuthActivity: jest.fn().mockResolvedValue({}),
}));
jest.mock("../config", () => ({
  googleClientId: "mock-client-id",
  googleClientSecret: "mock-client-secret",
  googleCallbackURL: "mock-callback-url",
}));

describe("Google OAuth Configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should configure Google strategy with correct options", () => {
    const configurePassport = require("../config/passport");
    configurePassport();

    expect(GoogleStrategy).toHaveBeenCalledWith(
      {
        clientID: "mock-client-id",
        clientSecret: "mock-client-secret",
        callbackURL: "mock-callback-url",
        scope: ["profile", "email"],
      },
      expect.any(Function)
    );

    expect(passport.use).toHaveBeenCalled();
    expect(passport.serializeUser).toHaveBeenCalled();
    expect(passport.deserializeUser).toHaveBeenCalled();
  });

  it("should handle existing user with Google ID", async () => {
    const configurePassport = require("../config/passport");
    configurePassport();

    // Get the callback function passed to GoogleStrategy
    const strategyCallback = GoogleStrategy.mock.calls[0][1];

    const mockUser = {
      _id: "user-id",
      googleId: "google-123",
      save: jest.fn().mockResolvedValue({}),
      lastLogin: null,
    };

    User.findOne.mockResolvedValue(mockUser);

    const mockProfile = {
      id: "google-123",
      displayName: "Test User",
      emails: [{ value: "test@example.com" }],
    };

    const done = jest.fn();

    await strategyCallback("access-token", "refresh-token", mockProfile, done);

    expect(User.findOne).toHaveBeenCalledWith({
      $or: [{ googleId: "google-123" }, { email: "test@example.com" }],
    });

    expect(mockUser.save).toHaveBeenCalled();
    expect(done).toHaveBeenCalledWith(null, mockUser);
  });

  it("should handle existing user without Google ID", async () => {
    const configurePassport = require("../config/passport");
    configurePassport();

    // Get the callback function passed to GoogleStrategy
    const strategyCallback = GoogleStrategy.mock.calls[0][1];

    const mockUser = {
      _id: "user-id",
      googleId: null,
      save: jest.fn().mockResolvedValue({}),
      lastLogin: null,
    };

    User.findOne.mockResolvedValue(mockUser);

    const mockProfile = {
      id: "google-123",
      displayName: "Test User",
      emails: [{ value: "test@example.com" }],
    };

    const done = jest.fn();

    await strategyCallback("access-token", "refresh-token", mockProfile, done);

    expect(mockUser.googleId).toBe("google-123");
    expect(mockUser.save).toHaveBeenCalled();
    expect(done).toHaveBeenCalledWith(null, mockUser);
  });

  it("should create new user if not exists", async () => {
    const configurePassport = require("../config/passport");
    configurePassport();

    // Get the callback function passed to GoogleStrategy
    const strategyCallback = GoogleStrategy.mock.calls[0][1];

    User.findOne.mockResolvedValue(null);

    const mockNewUser = {
      _id: "new-user-id",
      googleId: "google-123",
      email: "test@example.com",
    };

    User.create.mockResolvedValue(mockNewUser);

    const mockProfile = {
      id: "google-123",
      displayName: "Test User",
      name: {
        givenName: "Test",
        familyName: "User",
      },
      emails: [{ value: "test@example.com" }],
    };

    const done = jest.fn();

    await strategyCallback("access-token", "refresh-token", mockProfile, done);

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test User",
        email: "test@example.com",
        googleId: "google-123",
        status: "active",
      })
    );

    expect(done).toHaveBeenCalledWith(null, mockNewUser);
  });
});
