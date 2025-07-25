const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../config");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified("password")) {
    return next();
  }

  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    // Hash password
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
UserSchema.methods.generateAuthToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

// Generate refresh token
UserSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ id: this._id }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn,
  });
};

// Generate password reset token
UserSchema.methods.generatePasswordResetToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Create a virtual for user's full name
UserSchema.virtual("fullName").get(function () {
  return this.name;
});

// Create a method to update last login
UserSchema.methods.updateLastLogin = async function () {
  this.lastLogin = Date.now();
  await this.save();
};

// Create a static method to find or create a user by OAuth profile
UserSchema.statics.findOrCreateByOAuth = async function (profile, provider) {
  // Find user by provider ID
  let user = null;

  if (provider === "google" && profile.email) {
    // Try to find by email first
    user = await this.findOne({ email: profile.email });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId && profile.id) {
        user.googleId = profile.id;
        await user.save();
      }
    } else {
      // Create new user
      user = await this.create({
        name: profile.displayName || profile.name || "Google User",
        email: profile.email,
        googleId: profile.id,
        password: crypto.randomBytes(20).toString("hex"), // Random password
        status: "active",
      });
    }
  }

  return user;
};

module.exports = mongoose.model("User", UserSchema);
