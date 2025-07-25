const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Item variant schema
const ItemVariantSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Variant name is required"],
      trim: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, "Quantity cannot be negative"],
    },
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Item schema
const ItemSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [100, "Name cannot be more than 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot be more than 1000 characters"],
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, "Quantity cannot be negative"],
    },
    unit: {
      type: String,
      default: "unit",
      trim: true,
    },
    minLevel: {
      type: Number,
      default: 0,
      min: [0, "Minimum level cannot be negative"],
    },
    price: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    images: [
      {
        filename: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        path: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
        mimetype: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    hasVariants: {
      type: Boolean,
      default: false,
    },
    variants: [ItemVariantSchema],
    barcode: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    barcodeFormat: {
      type: String,
      enum: [
        "UPC_A",
        "UPC_E",
        "EAN_13",
        "EAN_8",
        "CODE_128",
        "CODE_39",
        "CODE_93",
        "CODABAR",
        "QR_CODE",
      ],
      default: "CODE_128",
    },
    barcodeHistory: [
      {
        barcode: String,
        format: String,
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    sku: {
      type: String,
      trim: true,
      sparse: true,
    },
    location: {
      type: String,
      trim: true,
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add index for search
ItemSchema.index({ name: "text", description: "text", tags: "text" });

// Virtual for total value
ItemSchema.virtual("value").get(function () {
  return this.price * this.quantity;
});

// Method to check if item is low on stock
ItemSchema.methods.isLowStock = function () {
  return this.quantity <= this.minLevel;
};

// Method to update quantity
ItemSchema.methods.updateQuantity = async function (change, reason = "manual") {
  const newQuantity = this.quantity + change;

  // Prevent negative quantity
  if (newQuantity < 0) {
    throw new Error("Cannot reduce quantity below zero");
  }

  this.quantity = newQuantity;
  await this.save();

  // Return activity data for logging
  return {
    itemId: this._id,
    previousQuantity: this.quantity - change,
    newQuantity: this.quantity,
    change,
    reason,
  };
};

// Pre-save hook to check for low stock
ItemSchema.pre("save", async function (next) {
  // If quantity changed and is now below minLevel, we should generate an alert
  if (this.isModified("quantity") && this.isLowStock()) {
    // Flag for alert generation
    this._generateAlert = true;
  }

  next();
});

// Post-save hook to generate alerts and update tag counts
ItemSchema.post("save", async function (doc, next) {
  if (doc._generateAlert) {
    try {
      const Alert = mongoose.model("Alert");

      // Create or update low quantity alert
      if (doc.quantity <= doc.minLevel) {
        await Alert.createLowQuantityAlert(doc);
      } else {
        // Check and resolve any existing alerts
        await Alert.checkAndResolveAlerts(doc);
      }
    } catch (error) {
      console.error("Error generating alert:", error);
    }
  }

  // Update tag counts
  if (doc.tags && doc.tags.length > 0) {
    try {
      const Tag = mongoose.model("Tag");
      for (const tagName of doc.tags) {
        const tag = await Tag.findOne({ name: tagName, userId: doc.userId });
        if (tag) {
          await tag.updateItemCount();
        }
      }
    } catch (error) {
      console.error("Error updating tag counts:", error);
    }
  }

  next();
});

// Post-remove hook to update tag counts
ItemSchema.post("findOneAndDelete", async function (doc) {
  if (doc && doc.tags && doc.tags.length > 0) {
    try {
      const Tag = mongoose.model("Tag");
      for (const tagName of doc.tags) {
        const tag = await Tag.findOne({ name: tagName, userId: doc.userId });
        if (tag) {
          await tag.updateItemCount();
        }
      }
    } catch (error) {
      console.error("Error updating tag counts:", error);
    }
  }
});

module.exports = mongoose.model("Item", ItemSchema);
