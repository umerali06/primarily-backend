const UserSettings = require("../models/settings.model");
const User = require("../models/user.model");
const ApiResponse = require("../utils/apiResponse");
const { CustomError } = require("../utils/customError");

// Get user settings
const getSettings = async (req, res, next) => {
  try {
    let settings = await UserSettings.findOne({ userId: req.user.id });

    if (!settings) {
      // Create default settings if none exist
      settings = new UserSettings({
        userId: req.user.id,
        ...UserSettings.getDefaultSettings(),
      });
      await settings.save();
    }

    return ApiResponse.success(res, "Settings retrieved successfully", {
      settings: settings.mergeWithDefaults(),
    });
  } catch (error) {
    next(error);
  }
};

// Update profile settings
const updateProfile = async (req, res, next) => {
  try {
    const {
      displayName,
      avatar,
      bio,
      timezone,
      language,
      dateFormat,
      timeFormat,
    } = req.body;

    let settings = await UserSettings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = new UserSettings({
        userId: req.user.id,
        ...UserSettings.getDefaultSettings(),
      });
    }

    // Update profile fields
    if (displayName !== undefined) settings.profile.displayName = displayName;
    if (avatar !== undefined) settings.profile.avatar = avatar;
    if (bio !== undefined) settings.profile.bio = bio;
    if (timezone !== undefined) settings.profile.timezone = timezone;
    if (language !== undefined) settings.profile.language = language;
    if (dateFormat !== undefined) settings.profile.dateFormat = dateFormat;
    if (timeFormat !== undefined) settings.profile.timeFormat = timeFormat;

    await settings.save();

    return ApiResponse.success(res, "Profile settings updated successfully", {
      profile: settings.profile,
    });
  } catch (error) {
    next(error);
  }
};

// Update preferences
const updatePreferences = async (req, res, next) => {
  try {
    const {
      defaultView,
      itemsPerPage,
      autoSave,
      theme,
      compactMode,
      showTutorials,
      defaultSortBy,
      defaultSortOrder,
    } = req.body;

    let settings = await UserSettings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = new UserSettings({
        userId: req.user.id,
        ...UserSettings.getDefaultSettings(),
      });
    }

    // Update preference fields
    if (defaultView !== undefined)
      settings.preferences.defaultView = defaultView;
    if (itemsPerPage !== undefined)
      settings.preferences.itemsPerPage = itemsPerPage;
    if (autoSave !== undefined) settings.preferences.autoSave = autoSave;
    if (theme !== undefined) settings.preferences.theme = theme;
    if (compactMode !== undefined)
      settings.preferences.compactMode = compactMode;
    if (showTutorials !== undefined)
      settings.preferences.showTutorials = showTutorials;
    if (defaultSortBy !== undefined)
      settings.preferences.defaultSortBy = defaultSortBy;
    if (defaultSortOrder !== undefined)
      settings.preferences.defaultSortOrder = defaultSortOrder;

    await settings.save();

    return ApiResponse.success(res, "Preferences updated successfully", {
      preferences: settings.preferences,
    });
  } catch (error) {
    next(error);
  }
};

// Update notification settings
const updateNotifications = async (req, res, next) => {
  try {
    const { email, push, inApp } = req.body;

    let settings = await UserSettings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = new UserSettings({
        userId: req.user.id,
        ...UserSettings.getDefaultSettings(),
      });
    }

    // Update notification settings
    if (email) {
      settings.notifications.email = {
        ...settings.notifications.email,
        ...email,
      };
    }
    if (push) {
      settings.notifications.push = { ...settings.notifications.push, ...push };
    }
    if (inApp) {
      settings.notifications.inApp = {
        ...settings.notifications.inApp,
        ...inApp,
      };
    }

    await settings.save();

    return ApiResponse.success(
      res,
      "Notification settings updated successfully",
      {
        notifications: settings.notifications,
      }
    );
  } catch (error) {
    next(error);
  }
};

// Update privacy settings
const updatePrivacy = async (req, res, next) => {
  try {
    const { profileVisibility, dataSharing, analytics, crashReports } =
      req.body;

    let settings = await UserSettings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = new UserSettings({
        userId: req.user.id,
        ...UserSettings.getDefaultSettings(),
      });
    }

    // Update privacy fields
    if (profileVisibility !== undefined)
      settings.privacy.profileVisibility = profileVisibility;
    if (dataSharing !== undefined) settings.privacy.dataSharing = dataSharing;
    if (analytics !== undefined) settings.privacy.analytics = analytics;
    if (crashReports !== undefined)
      settings.privacy.crashReports = crashReports;

    await settings.save();

    return ApiResponse.success(res, "Privacy settings updated successfully", {
      privacy: settings.privacy,
    });
  } catch (error) {
    next(error);
  }
};

// Update security settings
const updateSecurity = async (req, res, next) => {
  try {
    const { twoFactorEnabled, sessionTimeout, loginNotifications } = req.body;

    let settings = await UserSettings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = new UserSettings({
        userId: req.user.id,
        ...UserSettings.getDefaultSettings(),
      });
    }

    // Update security fields
    if (twoFactorEnabled !== undefined)
      settings.security.twoFactorEnabled = twoFactorEnabled;
    if (sessionTimeout !== undefined)
      settings.security.sessionTimeout = sessionTimeout;
    if (loginNotifications !== undefined)
      settings.security.loginNotifications = loginNotifications;

    await settings.save();

    return ApiResponse.success(res, "Security settings updated successfully", {
      security: settings.security,
    });
  } catch (error) {
    next(error);
  }
};

// Update integration settings
const updateIntegrations = async (req, res, next) => {
  try {
    const { googleDrive, dropbox, slack } = req.body;

    let settings = await UserSettings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = new UserSettings({
        userId: req.user.id,
        ...UserSettings.getDefaultSettings(),
      });
    }

    // Update integration settings
    if (googleDrive) {
      settings.integrations.googleDrive = {
        ...settings.integrations.googleDrive,
        ...googleDrive,
      };
    }
    if (dropbox) {
      settings.integrations.dropbox = {
        ...settings.integrations.dropbox,
        ...dropbox,
      };
    }
    if (slack) {
      settings.integrations.slack = {
        ...settings.integrations.slack,
        ...slack,
      };
    }

    await settings.save();

    return ApiResponse.success(
      res,
      "Integration settings updated successfully",
      {
        integrations: settings.integrations,
      }
    );
  } catch (error) {
    next(error);
  }
};

// Change password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      throw new CustomError("User not found", 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await user.matchPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new CustomError("Current password is incorrect", 400);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return ApiResponse.success(res, "Password changed successfully");
  } catch (error) {
    next(error);
  }
};

// Reset all settings to defaults
const resetSettings = async (req, res, next) => {
  try {
    let settings = await UserSettings.findOne({ userId: req.user.id });

    if (settings) {
      await UserSettings.findByIdAndDelete(settings._id);
    }

    // Create new default settings
    settings = new UserSettings({
      userId: req.user.id,
      ...UserSettings.getDefaultSettings(),
    });
    await settings.save();

    return ApiResponse.success(res, "Settings reset to defaults successfully", {
      settings: settings.mergeWithDefaults(),
    });
  } catch (error) {
    next(error);
  }
};

// Unified settings update
const updateSettings = async (req, res, next) => {
  try {
    const settingsData = req.body;

    let settings = await UserSettings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = new UserSettings({
        userId: req.user.id,
        ...UserSettings.getDefaultSettings(),
      });
    }

    // Update any provided fields
    Object.keys(settingsData).forEach((key) => {
      if (settingsData[key] !== undefined) {
        // Handle nested objects
        if (
          typeof settingsData[key] === "object" &&
          !Array.isArray(settingsData[key])
        ) {
          if (settings[key]) {
            settings[key] = { ...settings[key], ...settingsData[key] };
          } else {
            settings[key] = settingsData[key];
          }
        } else {
          // Handle direct properties
          settings[key] = settingsData[key];
        }
      }
    });

    await settings.save();

    return ApiResponse.success(res, "Settings updated successfully", {
      settings: settings.mergeWithDefaults(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  updateProfile,
  updatePreferences,
  updateNotifications,
  updatePrivacy,
  updateSecurity,
  updateIntegrations,
  changePassword,
  resetSettings,
};
