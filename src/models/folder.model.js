const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FolderSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Folder name is required"],
      trim: true,
      maxlength: [100, "Name cannot be more than 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot be more than 1000 characters"],
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    path: {
      type: String,
      default: "",
    },
    level: {
      type: Number,
      default: 1,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    color: {
      type: String,
      default: "#16A34A",
      trim: true,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
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
FolderSchema.index({ name: "text", description: "text", tags: "text" });
FolderSchema.index({ path: 1 });
FolderSchema.index({ userId: 1, parentId: 1 });

// Virtual for items in this folder
FolderSchema.virtual("items", {
  ref: "Item",
  localField: "_id",
  foreignField: "folderId",
});

// Virtual for subfolders
FolderSchema.virtual("subfolders", {
  ref: "Folder",
  localField: "_id",
  foreignField: "parentId",
});

// Method to get full path name (e.g., "Root / Subfolder / Child")
FolderSchema.methods.getFullPath = function () {
  if (!this.path) return this.name;

  const pathIds = this.path.split("/").filter((id) => id);
  return this.path
    ? `${this.name} (${pathIds.length + 1} levels deep)`
    : this.name;
};

// Method to check if folder is a child of another folder
FolderSchema.methods.isChildOf = function (potentialParentId) {
  if (!this.path) return false;
  return this.path.includes(`/${potentialParentId}/`);
};

// Method to get all ancestor folders
FolderSchema.methods.getAncestors = async function () {
  if (!this.path) return [];

  const ancestorIds = this.path.split("/").filter((id) => id);
  if (ancestorIds.length === 0) return [];

  return await this.model("Folder")
    .find({
      _id: { $in: ancestorIds.map((id) => mongoose.Types.ObjectId(id)) },
    })
    .sort({ level: 1 });
};

// Method to get all descendant folders
FolderSchema.methods.getDescendants = async function () {
  return await this.model("Folder")
    .find({
      path: new RegExp(`/${this._id}/`),
    })
    .sort({ path: 1 });
};

// Pre-save hook to update path and level
FolderSchema.pre("save", async function (next) {
  try {
    // If parentId is being modified
    if (this.isModified("parentId")) {
      // Check for circular reference
      if (this.parentId && this.parentId.toString() === this._id.toString()) {
        throw new Error("Folder cannot be its own parent");
      }

      // If this is an existing folder being moved
      if (!this.isNew && this.parentId) {
        // Check if new parent is a descendant of this folder (would create a loop)
        const parent = await this.model("Folder").findById(this.parentId);
        if (parent && parent.isChildOf(this._id.toString())) {
          throw new Error("Cannot move a folder to its own descendant");
        }
      }

      // Update path and level
      if (this.parentId) {
        const parent = await this.model("Folder").findById(this.parentId);
        if (!parent) {
          throw new Error("Parent folder not found");
        }

        this.path = parent.path
          ? `${parent.path}/${this.parentId}`
          : `/${this.parentId}`;
        this.level = parent.level + 1;
      } else {
        // Root folder
        this.path = "";
        this.level = 1;
      }

      // If this is an existing folder being moved, update all descendants
      if (!this.isNew) {
        const oldPath = this._oldPath || "";
        const descendants = await this.model("Folder").find({
          path: new RegExp(`^${oldPath}/${this._id}/`),
        });

        // Update each descendant's path and level
        for (const descendant of descendants) {
          const newPath = descendant.path.replace(oldPath, this.path);
          const levelDiff = this.level - (this._oldLevel || 1);

          await this.model("Folder").updateOne(
            { _id: descendant._id },
            {
              path: newPath,
              level: descendant.level + levelDiff,
            }
          );
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Store old path and level before changes
FolderSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      this._oldPath = docToUpdate.path;
      this._oldLevel = docToUpdate.level;
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Folder", FolderSchema);
