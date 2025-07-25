const mongoose = require("mongoose");

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    status: {
      type: String,
      enum: ["subscribed", "unsubscribed", "bounced"],
      default: "subscribed",
    },
    source: {
      type: String,
      default: "website",
    },
    preferences: {
      productUpdates: {
        type: Boolean,
        default: true,
      },
      tips: {
        type: Boolean,
        default: true,
      },
      news: {
        type: Boolean,
        default: true,
      },
    },
    unsubscribeToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    lastEmailSent: {
      type: Date,
    },
    subscriptionDate: {
      type: Date,
      default: Date.now,
    },
    unsubscribeDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
newsletterSchema.index({ status: 1 });
newsletterSchema.index({ subscriptionDate: -1 });

// Generate unsubscribe token before saving
newsletterSchema.pre("save", function (next) {
  if (this.isNew && !this.unsubscribeToken) {
    this.unsubscribeToken = require("crypto").randomBytes(32).toString("hex");
  }
  next();
});

module.exports = mongoose.model("Newsletter", newsletterSchema);
