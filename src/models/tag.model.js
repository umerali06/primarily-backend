const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tag name is required"],
      trim: true,
      minlength: [2, "Tag name must be at least 2 characters long"],
      maxlength: [50, "Tag name cannot exceed 50 characters"],
    },
    color: {
      type: String,
      default: "gray",
      enum: {
        values: [
          "gray",
          "red",
          "blue",
          "green",
          "yellow",
          "purple",
          "pink",
          "orange",
        ],
        message:
          "Color must be one of: gray, red, blue, green, yellow, purple, pink, orange",
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for unique tag names per user
tagSchema.index({ name: 1, userId: 1 }, { unique: true });

// Virtual for item count (will be populated in controller)
tagSchema.virtual("itemCount").get(function () {
  return this._itemCount || 0;
});

// Pre-save middleware to ensure name is unique per user
tagSchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    const existingTag = await this.constructor.findOne({
      name: this.name,
      userId: this.userId,
      _id: { $ne: this._id },
    });

    if (existingTag) {
      const error = new Error("Tag name already exists for this user");
      error.name = "ValidationError";
      return next(error);
    }
  }
  next();
});

// Pre-save middleware to normalize name
tagSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = this.name.trim();
  }
  next();
});

// Static method to get tags with item counts
tagSchema.statics.getTagsWithCounts = async function (userId) {
  const tags = await this.find({ userId });

  const tagsWithCounts = await Promise.all(
    tags.map(async (tag) => {
      const itemCount = await mongoose.model("Item").countDocuments({
        userId,
        tags: tag.name,
      });

      return {
        ...tag.toObject(),
        itemCount,
      };
    })
  );

  return tagsWithCounts;
};

// Instance method to get items with this tag
tagSchema.methods.getItems = async function () {
  return await mongoose.model("Item").find({
    userId: this.userId,
    tags: this.name,
  });
};

const Tag = mongoose.model("Tag", tagSchema);

module.exports = Tag;
