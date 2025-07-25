const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    profile: {
      displayName: {
        type: String,
        trim: true,
        maxlength: 100,
      },
      avatar: {
        type: String,
        trim: true,
      },
      bio: {
        type: String,
        trim: true,
        maxlength: 500,
      },
      timezone: {
        type: String,
        default: "UTC",
      },
      language: {
        type: String,
        default: "en",
        enum: ["en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh"],
      },
      dateFormat: {
        type: String,
        default: "MM/DD/YYYY",
        enum: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
      },
      timeFormat: {
        type: String,
        default: "12h",
        enum: ["12h", "24h"],
      },
    },
    preferences: {
      defaultView: {
        type: String,
        enum: ["grid", "list", "table"],
        default: "grid",
      },
      itemsPerPage: {
        type: Number,
        default: 20,
        min: 10,
        max: 100,
      },
      autoSave: {
        type: Boolean,
        default: true,
      },
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "light",
      },
      compactMode: {
        type: Boolean,
        default: false,
      },
      showTutorials: {
        type: Boolean,
        default: true,
      },
      defaultSortBy: {
        type: String,
        default: "createdAt",
        enum: ["name", "createdAt", "updatedAt", "quantity", "price"],
      },
      defaultSortOrder: {
        type: String,
        default: "desc",
        enum: ["asc", "desc"],
      },
    },
    notifications: {
      email: {
        enabled: {
          type: Boolean,
          default: true,
        },
        lowStock: {
          type: Boolean,
          default: true,
        },
        reports: {
          type: Boolean,
          default: false,
        },
        updates: {
          type: Boolean,
          default: true,
        },
        marketing: {
          type: Boolean,
          default: false,
        },
      },
      push: {
        enabled: {
          type: Boolean,
          default: true,
        },
        lowStock: {
          type: Boolean,
          default: true,
        },
        reports: {
          type: Boolean,
          default: false,
        },
        updates: {
          type: Boolean,
          default: true,
        },
      },
      inApp: {
        enabled: {
          type: Boolean,
          default: true,
        },
        lowStock: {
          type: Boolean,
          default: true,
        },
        reports: {
          type: Boolean,
          default: true,
        },
        updates: {
          type: Boolean,
          default: true,
        },
      },
    },
    privacy: {
      profileVisibility: {
        type: String,
        enum: ["public", "private", "team"],
        default: "private",
      },
      dataSharing: {
        type: Boolean,
        default: false,
      },
      analytics: {
        type: Boolean,
        default: true,
      },
      crashReports: {
        type: Boolean,
        default: true,
      },
    },
    security: {
      twoFactorEnabled: {
        type: Boolean,
        default: false,
      },
      sessionTimeout: {
        type: Number,
        default: 24, // hours
        min: 1,
        max: 168, // 1 week
      },
      loginNotifications: {
        type: Boolean,
        default: true,
      },
    },
    integrations: {
      googleDrive: {
        enabled: {
          type: Boolean,
          default: false,
        },
        folderId: String,
      },
      dropbox: {
        enabled: {
          type: Boolean,
          default: false,
        },
        accessToken: String,
      },
      slack: {
        enabled: {
          type: Boolean,
          default: false,
        },
        webhookUrl: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries

// Method to get default settings
userSettingsSchema.statics.getDefaultSettings = function () {
  return {
    profile: {
      timezone: "UTC",
      language: "en",
      dateFormat: "MM/DD/YYYY",
      timeFormat: "12h",
    },
    preferences: {
      defaultView: "grid",
      itemsPerPage: 20,
      autoSave: true,
      theme: "light",
      compactMode: false,
      showTutorials: true,
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
    },
    notifications: {
      email: {
        enabled: true,
        lowStock: true,
        reports: false,
        updates: true,
        marketing: false,
      },
      push: {
        enabled: true,
        lowStock: true,
        reports: false,
        updates: true,
      },
      inApp: {
        enabled: true,
        lowStock: true,
        reports: true,
        updates: true,
      },
    },
    privacy: {
      profileVisibility: "private",
      dataSharing: false,
      analytics: true,
      crashReports: true,
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 24,
      loginNotifications: true,
    },
    integrations: {
      googleDrive: { enabled: false },
      dropbox: { enabled: false },
      slack: { enabled: false },
    },
  };
};

// Method to merge with defaults
userSettingsSchema.methods.mergeWithDefaults = function () {
  const defaults = this.constructor.getDefaultSettings();

  // Deep merge function
  const deepMerge = (target, source) => {
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        target[key] = target[key] || {};
        deepMerge(target[key], source[key]);
      } else if (target[key] === undefined) {
        target[key] = source[key];
      }
    }
    return target;
  };

  return deepMerge(this.toObject(), defaults);
};

module.exports = mongoose.model("UserSettings", userSettingsSchema);
