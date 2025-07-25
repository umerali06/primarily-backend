const mongoose = require("mongoose");

const enterpriseLeadSchema = new mongoose.Schema(
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
    country: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    users: {
      type: String,
      required: true,
      enum: ["12-15", "16-20", "21+"],
    },
    agree: {
      type: Boolean,
      required: true,
      validate: {
        validator: function (v) {
          return v === true;
        },
        message: "You must agree to the terms and conditions",
      },
    },
    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "converted", "closed"],
      default: "new",
    },
    notes: {
      type: String,
      default: "",
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

// Index for efficient querying
enterpriseLeadSchema.index({ email: 1 });
enterpriseLeadSchema.index({ status: 1 });
enterpriseLeadSchema.index({ createdAt: -1 });

module.exports = mongoose.model("EnterpriseLead", enterpriseLeadSchema);
