const mongoose = require("mongoose");

const onboardingProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    selectedCategories: [
      {
        type: String,
        enum: [
          "retail",
          "manufacturing",
          "healthcare",
          "education",
          "construction",
          "food-service",
          "automotive",
          "technology",
          "other",
        ],
      },
    ],
    businessType: {
      type: String,
      enum: ["small-business", "medium-business", "enterprise", "personal"],
      required: true,
    },
    teamSize: {
      type: Number,
      min: 1,
      max: 10000,
    },
    goals: [
      {
        type: String,
        enum: [
          "track-inventory",
          "reduce-costs",
          "improve-efficiency",
          "compliance",
          "reporting",
          "automation",
        ],
      },
    ],
    preferences: {
      defaultView: {
        type: String,
        enum: ["grid", "list", "table"],
        default: "grid",
      },
      notifications: {
        type: Boolean,
        default: true,
      },
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "light",
      },
      language: {
        type: String,
        default: "en",
      },
      timezone: {
        type: String,
        default: "UTC",
      },
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
onboardingProfileSchema.index({ businessType: 1 });
onboardingProfileSchema.index({ completedAt: -1 });

// Method to mark onboarding as completed
onboardingProfileSchema.methods.markCompleted = function () {
  this.isCompleted = true;
  this.completedAt = new Date();
  return this.save();
};

// Static method to get user preferences
onboardingProfileSchema.statics.getUserPreferences = async function (userId) {
  const profile = await this.findOne({ userId });
  return profile ? profile.preferences : null;
};

module.exports = mongoose.model("OnboardingProfile", onboardingProfileSchema);
