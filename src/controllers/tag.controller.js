const Tag = require("../models/tag.model");
const Item = require("../models/item.model");
const ApiResponse = require("../utils/apiResponse");
const { CustomError } = require("../utils/customError");

// Get all tags
const getTags = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { userId: req.user.id };

    // Add search filter
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get tags with item counts
    const allTagsWithCounts = await Tag.getTagsWithCounts(req.user.id);

    // Apply search filter
    let filteredTags = allTagsWithCounts;
    if (search) {
      filteredTags = allTagsWithCounts.filter((tag) =>
        tag.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply sorting
    filteredTags.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const multiplier = sortOrder === "desc" ? -1 : 1;

      if (aVal < bVal) return -1 * multiplier;
      if (aVal > bVal) return 1 * multiplier;
      return 0;
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const tags = filteredTags.slice(startIndex, startIndex + parseInt(limit));

    const total = filteredTags.length;

    return ApiResponse.success(res, "Tags retrieved successfully", {
      tags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get tag by ID
const getTag = async (req, res, next) => {
  try {
    const tag = await Tag.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!tag) {
      throw new CustomError("Tag not found", 404);
    }

    return ApiResponse.success(res, "Tag retrieved successfully", { tag });
  } catch (error) {
    next(error);
  }
};

// Create new tag
const createTag = async (req, res, next) => {
  try {
    const { name, color, description } = req.body;

    // Check if tag already exists
    const existingTag = await Tag.findOne({
      name: name.toLowerCase(),
      userId: req.user.id,
    });

    if (existingTag) {
      throw new CustomError("Tag already exists", 400);
    }

    const tag = new Tag({
      name: name.toLowerCase(),
      color: color || "gray",
      description,
      userId: req.user.id,
    });

    await tag.save();

    return ApiResponse.created(res, "Tag created successfully", { tag });
  } catch (error) {
    next(error);
  }
};

// Update tag
const updateTag = async (req, res, next) => {
  try {
    const { name, color, description } = req.body;

    const tag = await Tag.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!tag) {
      throw new CustomError("Tag not found", 404);
    }

    // Check if new name conflicts with existing tag
    if (name && name.toLowerCase() !== tag.name) {
      const existingTag = await Tag.findOne({
        name: name.toLowerCase(),
        userId: req.user.id,
        _id: { $ne: tag._id },
      });

      if (existingTag) {
        throw new CustomError("Tag name already exists", 400);
      }

      // Update items with old tag name
      await Item.updateMany(
        { userId: req.user.id, tags: tag.name },
        { $set: { "tags.$": name.toLowerCase() } }
      );
    }

    // Update tag
    if (name) tag.name = name.toLowerCase();
    if (color) tag.color = color;
    if (description !== undefined) tag.description = description;

    await tag.save();

    return ApiResponse.success(res, "Tag updated successfully", { tag });
  } catch (error) {
    next(error);
  }
};

// Delete tag
const deleteTag = async (req, res, next) => {
  try {
    const tag = await Tag.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!tag) {
      throw new CustomError("Tag not found", 404);
    }

    // Remove tag from all items
    await Item.updateMany(
      { userId: req.user.id, tags: tag.name },
      { $pull: { tags: tag.name } }
    );

    await Tag.findByIdAndDelete(req.params.id);

    return ApiResponse.success(res, "Tag deleted successfully");
  } catch (error) {
    next(error);
  }
};

// Get items by tag
const getItemsByTag = async (req, res, next) => {
  try {
    const { tagName } = req.params;
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {
      userId: req.user.id,
      tags: tagName.toLowerCase(),
    };

    // Add search filter
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const items = await Item.find(query)
      .populate("folderId", "name path")
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Item.countDocuments(query);

    // Calculate totals
    const totals = await Item.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$quantity", "$price"] } },
        },
      },
    ]);

    const summary = totals[0] || { totalQuantity: 0, totalValue: 0 };

    return ApiResponse.success(res, "Items retrieved successfully", {
      items,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get tag statistics
const getTagStats = async (req, res, next) => {
  try {
    const stats = await Tag.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: null,
          totalTags: { $sum: 1 },
          totalItems: { $sum: "$itemCount" },
          avgItemsPerTag: { $avg: "$itemCount" },
        },
      },
    ]);

    const result = stats[0] || {
      totalTags: 0,
      totalItems: 0,
      avgItemsPerTag: 0,
    };

    return ApiResponse.success(
      res,
      "Tag statistics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  getItemsByTag,
  getTagStats,
};
