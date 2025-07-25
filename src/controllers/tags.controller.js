const Tag = require("../models/tag.model");
const Item = require("../models/item.model");
const { apiResponse } = require("../utils/apiResponse");
const logger = require("../config/logger");

const tagsController = {
  // Get all tags for the authenticated user
  getTags: async (req, res) => {
    try {
      const { page = 1, limit = 50, search = "" } = req.query;
      const skip = (page - 1) * limit;

      const query = { userId: req.user.id };
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      const tags = await Tag.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Get item count for each tag
      const tagsWithCounts = await Promise.all(
        tags.map(async (tag) => {
          const itemCount = await Item.countDocuments({
            userId: req.user.id,
            tags: tag.name,
          });
          return {
            ...tag.toObject(),
            itemCount,
          };
        })
      );

      const total = await Tag.countDocuments(query);

      res.json(
        apiResponse.success({
          tags: tagsWithCounts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        })
      );
    } catch (error) {
      logger.error("Error fetching tags:", error);
      res.status(500).json(apiResponse.error("Failed to fetch tags"));
    }
  },

  // Get tag by ID
  getTag: async (req, res) => {
    try {
      const tag = await Tag.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!tag) {
        return res.status(404).json(apiResponse.error("Tag not found"));
      }

      // Get item count for the tag
      const itemCount = await Item.countDocuments({
        userId: req.user.id,
        tags: tag.name,
      });

      const tagWithCount = {
        ...tag.toObject(),
        itemCount,
      };

      res.json(apiResponse.success({ tag: tagWithCount }));
    } catch (error) {
      logger.error("Error fetching tag:", error);
      res.status(500).json(apiResponse.error("Failed to fetch tag"));
    }
  },

  // Create new tag
  createTag: async (req, res) => {
    try {
      const { name, color = "gray", description = "" } = req.body;

      // Check if tag already exists for this user
      const existingTag = await Tag.findOne({
        name: name.trim(),
        userId: req.user.id,
      });

      if (existingTag) {
        return res.status(400).json(apiResponse.error("Tag already exists"));
      }

      const tag = new Tag({
        name: name.trim(),
        color,
        description: description.trim(),
        userId: req.user.id,
      });

      await tag.save();

      logger.info(`Tag created: ${tag.name} by user ${req.user.id}`);

      res.status(201).json(
        apiResponse.success({
          tag,
          message: "Tag created successfully",
        })
      );
    } catch (error) {
      logger.error("Error creating tag:", error);
      res.status(500).json(apiResponse.error("Failed to create tag"));
    }
  },

  // Update tag
  updateTag: async (req, res) => {
    try {
      const { name, color, description } = req.body;
      const tagId = req.params.id;

      const tag = await Tag.findOne({
        _id: tagId,
        userId: req.user.id,
      });

      if (!tag) {
        return res.status(404).json(apiResponse.error("Tag not found"));
      }

      // Check if new name conflicts with existing tag
      if (name && name.trim() !== tag.name) {
        const existingTag = await Tag.findOne({
          name: name.trim(),
          userId: req.user.id,
          _id: { $ne: tagId },
        });

        if (existingTag) {
          return res
            .status(400)
            .json(apiResponse.error("Tag name already exists"));
        }
      }

      // Update tag
      const updateData = {};
      if (name) updateData.name = name.trim();
      if (color) updateData.color = color;
      if (description !== undefined)
        updateData.description = description.trim();

      const updatedTag = await Tag.findByIdAndUpdate(tagId, updateData, {
        new: true,
        runValidators: true,
      });

      logger.info(`Tag updated: ${updatedTag.name} by user ${req.user.id}`);

      res.json(
        apiResponse.success({
          tag: updatedTag,
          message: "Tag updated successfully",
        })
      );
    } catch (error) {
      logger.error("Error updating tag:", error);
      res.status(500).json(apiResponse.error("Failed to update tag"));
    }
  },

  // Delete tag
  deleteTag: async (req, res) => {
    try {
      const tagId = req.params.id;

      const tag = await Tag.findOne({
        _id: tagId,
        userId: req.user.id,
      });

      if (!tag) {
        return res.status(404).json(apiResponse.error("Tag not found"));
      }

      // Remove tag from all items that use it
      await Item.updateMany(
        { userId: req.user.id, tags: tag.name },
        { $pull: { tags: tag.name } }
      );

      await Tag.findByIdAndDelete(tagId);

      logger.info(`Tag deleted: ${tag.name} by user ${req.user.id}`);

      res.json(
        apiResponse.success({
          message: "Tag deleted successfully",
        })
      );
    } catch (error) {
      logger.error("Error deleting tag:", error);
      res.status(500).json(apiResponse.error("Failed to delete tag"));
    }
  },

  // Get items by tag name
  getItemsByTag: async (req, res) => {
    try {
      const { name } = req.params;
      const { page = 1, limit = 50, search = "" } = req.query;
      const skip = (page - 1) * limit;

      const query = {
        userId: req.user.id,
        tags: name,
      };

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      const items = await Item.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Item.countDocuments(query);

      res.json(
        apiResponse.success({
          items,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        })
      );
    } catch (error) {
      logger.error("Error fetching items by tag:", error);
      res.status(500).json(apiResponse.error("Failed to fetch items by tag"));
    }
  },

  // Get tag statistics
  getTagStats: async (req, res) => {
    try {
      const userId = req.user.id;

      // Get all tags for the user
      const tags = await Tag.find({ userId });

      // Get statistics for each tag
      const tagStats = await Promise.all(
        tags.map(async (tag) => {
          const items = await Item.find({
            userId,
            tags: tag.name,
          });

          const totalQuantity = items.reduce(
            (sum, item) => sum + (item.quantity || 0),
            0
          );
          const totalValue = items.reduce(
            (sum, item) => sum + (item.quantity || 0) * (item.price || 0),
            0
          );

          return {
            tag: tag.name,
            color: tag.color,
            itemCount: items.length,
            totalQuantity,
            totalValue,
          };
        })
      );

      // Calculate overall statistics
      const totalTags = tags.length;
      const totalItems = await Item.countDocuments({ userId });
      const totalValue = tagStats.reduce(
        (sum, stat) => sum + stat.totalValue,
        0
      );

      res.json(
        apiResponse.success({
          tagStats,
          summary: {
            totalTags,
            totalItems,
            totalValue,
          },
        })
      );
    } catch (error) {
      logger.error("Error fetching tag statistics:", error);
      res.status(500).json(apiResponse.error("Failed to fetch tag statistics"));
    }
  },
};

module.exports = tagsController;
