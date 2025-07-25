const mongoose = require("mongoose");

const trialSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "converted", "cancelled"],
      default: "active",
    },
    trialType: {
      type: String,
      enum: ["free", "extended", "premium"],
      default: "free",
    },
    features: [
      {
        type: String,
        enum: [
          "basic-inventory",
          "advanced-reports",
          "bulk-operations",
          "api-access",
          "priority-support",
          "custom-fields",
          "integrations",
        ],
      },
    ],
    billingInfo: {
      email: {
        type: String,
        trim: true,
      },
      company: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
      },
    },
    usage: {
      itemsCreated: {
        type: Number,
        default: 0,
      },
      foldersCreated: {
        type: Number,
        default: 0,
      },
      reportsGenerated: {
        type: Number,
        default: 0,
      },
      lastActivity: {
        type: Date,
        default: Date.now,
      },
    },
    conversionData: {
      convertedAt: Date,
      planSelected: String,
      conversionSource: String,
    },
    extensions: [
      {
        extendedAt: Date,
        extendedBy: Number, // days
        reason: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
trialSubscriptionSchema.index({ status: 1 });
trialSubscriptionSchema.index({ endDate: 1 });

// Virtual for days remaining
trialSubscriptionSchema.virtual("daysRemaining").get(function () {
  if (this.status !== "active") return 0;
  const now = new Date();
  const diffTime = this.endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Virtual for trial progress (0-100)
trialSubscriptionSchema.virtual("progress").get(function () {
  const totalDays = Math.ceil(
    (this.endDate - this.startDate) / (1000 * 60 * 60 * 24)
  );
  const daysUsed = totalDays - this.daysRemaining;
  return Math.min(100, Math.max(0, (daysUsed / totalDays) * 100));
});

// Method to check if trial is expired
trialSubscriptionSchema.methods.isExpired = function () {
  return new Date() > this.endDate;
};

// Method to extend trial
trialSubscriptionSchema.methods.extend = function (
  days,
  reason = "Manual extension"
) {
  this.endDate = new Date(this.endDate.getTime() + days * 24 * 60 * 60 * 1000);
  this.extensions.push({
    extendedAt: new Date(),
    extendedBy: days,
    reason,
  });
  return this.save();
};

// Method to convert trial
trialSubscriptionSchema.methods.convert = function (
  planSelected,
  conversionSource = "trial"
) {
  this.status = "converted";
  this.conversionData = {
    convertedAt: new Date(),
    planSelected,
    conversionSource,
  };
  return this.save();
};

// Method to update usage
trialSubscriptionSchema.methods.updateUsage = function (
  usageType,
  increment = 1
) {
  if (this.usage[usageType] !== undefined) {
    this.usage[usageType] += increment;
  }
  this.usage.lastActivity = new Date();
  return this.save();
};

// Static method to create default trial
trialSubscriptionSchema.statics.createDefaultTrial = async function (
  userId,
  trialDays = 14
) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + trialDays);

  const trial = new this({
    userId,
    endDate,
    features: ["basic-inventory", "advanced-reports"],
  });

  return trial.save();
};

// Pre-save middleware to update status based on dates
trialSubscriptionSchema.pre("save", function (next) {
  if (this.isExpired() && this.status === "active") {
    this.status = "expired";
  }
  next();
});

module.exports = mongoose.model("TrialSubscription", trialSubscriptionSchema);
