const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "general-inquiry",
        "technical-support",
        "billing-question",
        "feature-request",
        "partnership",
        "other",
      ],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["new", "in-progress", "resolved", "closed"],
      default: "new",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    response: {
      type: String,
      trim: true,
    },
    responseDate: {
      type: Date,
    },
    source: {
      type: String,
      default: "website",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
contactSchema.index({ email: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ reason: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ priority: 1 });

module.exports = mongoose.model("Contact", contactSchema);
