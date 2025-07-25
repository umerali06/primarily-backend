const OnboardingProfile = require("../models/onboarding.model");
const ApiResponse = require("../utils/apiResponse");
const CustomError = require("../utils/customError");

// Get onboarding status
const getOnboardingStatus = async (req, res, next) => {
  try {
    const profile = await OnboardingProfile.findOne({ userId: req.user.id });

    res.json(
      new ApiResponse(200, "Onboarding status retrieved successfully", {
        isCompleted: profile ? profile.isCompleted : false,
        profile: profile || null,
      })
    );
  } catch (error) {
    next(error);
  }
};

// Complete onboarding
const completeOnboarding = async (req, res, next) => {
  try {
    const { selectedCategories, businessType, teamSize, goals, preferences } =
      req.body;

    // Check if onboarding already exists
    let profile = await OnboardingProfile.findOne({ userId: req.user.id });

    if (profile) {
      // Update existing profile
      profile.selectedCategories =
        selectedCategories || profile.selectedCategories;
      profile.businessType = businessType || profile.businessType;
      profile.teamSize = teamSize || profile.teamSize;
      profile.goals = goals || profile.goals;
      profile.preferences = { ...profile.preferences, ...preferences };
      await profile.markCompleted();
    } else {
      // Create new profile
      profile = new OnboardingProfile({
        userId: req.user.id,
        selectedCategories: selectedCategories || [],
        businessType,
        teamSize,
        goals: goals || [],
        preferences: {
          defaultView: preferences?.defaultView || "grid",
          notifications: preferences?.notifications !== false,
          theme: preferences?.theme || "light",
          language: preferences?.language || "en",
          timezone: preferences?.timezone || "UTC",
        },
        isCompleted: true,
      });
      await profile.save();
    }

    res.status(201).json(
      new ApiResponse(201, "Onboarding completed successfully", {
        profile,
      })
    );
  } catch (error) {
    next(error);
  }
};

// Update onboarding preferences
const updatePreferences = async (req, res, next) => {
  try {
    const { preferences } = req.body;

    const profile = await OnboardingProfile.findOne({ userId: req.user.id });

    if (!profile) {
      throw new CustomError("Onboarding profile not found", 404);
    }

    profile.preferences = { ...profile.preferences, ...preferences };
    await profile.save();

    res.json(
      new ApiResponse(200, "Preferences updated successfully", {
        preferences: profile.preferences,
      })
    );
  } catch (error) {
    next(error);
  }
};

// Get user preferences
const getPreferences = async (req, res, next) => {
  try {
    const preferences = await OnboardingProfile.getUserPreferences(req.user.id);

    res.json(
      new ApiResponse(200, "Preferences retrieved successfully", {
        preferences: preferences || {
          defaultView: "grid",
          notifications: true,
          theme: "light",
          language: "en",
          timezone: "UTC",
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// Skip onboarding
const skipOnboarding = async (req, res, next) => {
  try {
    let profile = await OnboardingProfile.findOne({ userId: req.user.id });

    if (!profile) {
      profile = new OnboardingProfile({
        userId: req.user.id,
        businessType: "personal",
        isCompleted: true,
        preferences: {
          defaultView: "grid",
          notifications: true,
          theme: "light",
          language: "en",
          timezone: "UTC",
        },
      });
    } else {
      profile.isCompleted = true;
      profile.completedAt = new Date();
    }

    await profile.save();

    res.json(
      new ApiResponse(200, "Onboarding skipped successfully", {
        profile,
      })
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOnboardingStatus,
  completeOnboarding,
  updatePreferences,
  getPreferences,
  skipOnboarding,
};
