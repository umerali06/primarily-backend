const Item = require("../models/item.model");
const Activity = require("../models/activity.model");
const ApiResponse = require("../utils/apiResponse");
const {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} = require("../utils/customError");
const { deleteFile, getFileUrl } = require("../middleware/upload");
const { createImageMetadata } = require("../utils/imageProcessor");
const notificationService = require("../services/notificationService");
const mongoose = require("mongoose");
const path = require("path");

/**
 * @desc    Create a new item
 * @route   POST /api/items
 * @access  Private
 */
exports.createItem = async (req, res, next) => {
  try {
    // Add user ID to request body
    req.body.userId = req.user.id;

    // Process uploaded images
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        url: `${req.protocol}://${req.get("host")}/uploads/items/${
          file.filename
        }`,
      }));
    }

    // Add images to request body
    req.body.images = images;

    // Create item
    const item = await Item.create(req.body);

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: item._id,
      resourceType: "item",
      type: "item_create",
      title: "Item Created",
      description: `Item "${item.name}" was created`,
      details: {
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        folderId: item.folderId,
      },
    });

    // Emit notification event
    notificationService.emitItemEvent("created", {
      item,
      userId: req.user.id,
    });

    return ApiResponse.created(res, "Item created successfully", { item });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all items
 * @route   GET /api/items
 * @access  Private
 */
exports.getItems = async (req, res, next) => {
  try {
    // Build query
    const query = { userId: req.user.id };

    // Filter by folder
    if (req.query.folderId) {
      if (req.query.folderId === "null") {
        query.folderId = null;
      } else {
        query.folderId = req.query.folderId;
      }
    }

    // Filter by search term
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Filter by tags
    if (req.query.tags) {
      const tags = req.query.tags.split(",");
      query.tags = { $in: tags };
    }

    // Filter by low stock
    if (req.query.lowStock === "true") {
      query.$expr = { $lte: ["$quantity", "$minLevel"] };
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    // Sort
    let sortBy = {};
    if (req.query.sortBy) {
      const parts = req.query.sortBy.split(":");
      sortBy[parts[0]] = parts[1] === "desc" ? -1 : 1;
    } else {
      sortBy = { createdAt: -1 };
    }

    // Execute query
    const items = await Item.find(query)
      .sort(sortBy)
      .skip(startIndex)
      .limit(limit)
      .populate("folderId", "name");

    // Get total count
    const total = await Item.countDocuments(query);

    return ApiResponse.success(res, "Items retrieved successfully", {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get item by ID
 * @route   GET /api/items/:id
 * @access  Private
 */
exports.getItemById = async (req, res, next) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate("folderId", "name");

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    return ApiResponse.success(res, "Item retrieved successfully", { item });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update item
 * @route   PUT /api/items/:id
 * @access  Private
 */
exports.updateItem = async (req, res, next) => {
  try {
    // Find item
    let item = await Item.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Process uploaded images
    let images = item.images || [];
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        url: `${req.protocol}://${req.get("host")}/uploads/items/${
          file.filename
        }`,
      }));

      // Combine existing and new images
      images = [...images, ...newImages];
    }

    // Add images to request body
    req.body.images = images;

    // Store previous item state for comparison
    const previousItem = { ...item.toObject() };

    // Track changes for activity log
    const changes = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (item[key] !== value && key !== "userId") {
        changes[key] = {
          from: item[key],
          to: value,
        };
      }
    }

    // Update item
    item = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    // Log activity if there were changes
    if (Object.keys(changes).length > 0) {
      await Activity.create({
        userId: req.user.id,
        resourceId: item._id,
        resourceType: "item",
        type: "item_update",
        title: "Item Updated",
        description: `Item "${item.name}" was updated`,
        details: {
          changes,
          name: item.name,
        },
      });

      // Emit notification event
      notificationService.emitItemEvent("updated", {
        item,
        previousItem,
        userId: req.user.id,
        changes,
      });
    }

    return ApiResponse.success(res, "Item updated successfully", { item });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete item
 * @route   DELETE /api/items/:id
 * @access  Private
 */
exports.deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Store item details before deletion
    const itemForNotification = { ...item.toObject() };

    // Log activity before deletion
    await Activity.create({
      userId: req.user.id,
      resourceId: item._id,
      resourceType: "item",
      type: "item_delete",
      title: "Item Deleted",
      description: `Item "${item.name}" was deleted`,
      details: {
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        folderId: item.folderId,
      },
    });

    await item.deleteOne();

    // Emit notification event
    notificationService.emitItemEvent("deleted", {
      item: itemForNotification,
      userId: req.user.id,
    });

    return ApiResponse.success(res, "Item deleted successfully");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update item quantity
 * @route   PUT /api/items/:id/quantity
 * @access  Private
 */
exports.updateQuantity = async (req, res, next) => {
  try {
    const { change, reason } = req.body;

    if (change === undefined || isNaN(change)) {
      return next(
        new BadRequestError("Quantity change is required and must be a number")
      );
    }

    // Find item
    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Store previous quantity for notification
    const previousQuantity = item.quantity;

    // Update quantity
    try {
      const result = await item.updateQuantity(
        Number(change),
        reason || "manual"
      );

      // Log activity
      await Activity.create({
        userId: req.user.id,
        resourceId: item._id,
        resourceType: "item",
        type: "quantity_change",
        title: "Quantity Changed",
        description: `Item "${item.name}" quantity changed from ${previousQuantity} to ${item.quantity}`,
        details: {
          name: item.name,
          previousQuantity,
          newQuantity: item.quantity,
          change: Number(change),
          reason: reason || "manual",
        },
      });

      // Emit quantity change notification
      notificationService.emitItemEvent("quantity_changed", {
        item,
        previousQuantity,
        newQuantity: item.quantity,
        userId: req.user.id,
      });

      return ApiResponse.success(res, "Item quantity updated successfully", {
        item,
        quantityChange: result,
      });
    } catch (error) {
      return next(new BadRequestError(error.message));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add item image
 * @route   POST /api/items/:id/images
 * @access  Private
 */
exports.addItemImage = async (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return next(new BadRequestError("No image file provided"));
    }

    // Find item
    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      // Delete uploaded file if item not found
      deleteFile(req.file.path);
      return next(new NotFoundError("Item not found"));
    }

    // Generate image URL and metadata
    const imageUrl = getFileUrl(req, req.file.filename);
    const imageMetadata = createImageMetadata(req.file, imageUrl);

    // Add image to item
    item.images.push(imageUrl);
    await item.save();

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: item._id,
      resourceType: "item",
      action: "add_image",
      details: {
        name: item.name,
        imageUrl,
        filename: req.file.filename,
        fileSize: req.file.size,
        mimetype: req.file.mimetype,
      },
    });

    return ApiResponse.success(res, "Image added successfully", {
      item,
      imageUrl,
      metadata: imageMetadata,
    });
  } catch (error) {
    // Delete uploaded file on error
    if (req.file) {
      deleteFile(req.file.path);
    }
    next(error);
  }
};

/**
 * @desc    Remove item image
 * @route   DELETE /api/items/:id/images/:imageIndex
 * @access  Private
 */
exports.removeItemImage = async (req, res, next) => {
  try {
    const { imageIndex } = req.params;

    // Find item
    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Check if image exists
    if (!item.images[imageIndex]) {
      return next(new NotFoundError("Image not found"));
    }

    // Get image URL and extract filename
    const removedImage = item.images.splice(imageIndex, 1)[0];
    const filename = path.basename(removedImage);

    // Delete physical file
    const filePath = path.join(__dirname, "../../uploads/items", filename);
    deleteFile(filePath);

    await item.save();

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: item._id,
      resourceType: "item",
      action: "remove_image",
      details: {
        name: item.name,
        imageUrl: removedImage,
        filename,
      },
    });

    return ApiResponse.success(res, "Image removed successfully", {
      item,
      removedImage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Move item to folder
 * @route   PUT /api/items/:id/move
 * @access  Private
 */
exports.moveItem = async (req, res, next) => {
  try {
    const { folderId } = req.body;

    // Find item
    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Store previous folder ID for activity log
    const previousFolderId = item.folderId;

    // Update folder
    item.folderId = folderId === "null" ? null : folderId;
    await item.save();

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: item._id,
      resourceType: "item",
      action: "move",
      details: {
        name: item.name,
        from: previousFolderId,
        to: item.folderId,
      },
    });

    return ApiResponse.success(res, "Item moved successfully", { item });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add multiple item images
 * @route   POST /api/items/:id/images/multiple
 * @access  Private
 */
exports.addMultipleImages = async (req, res, next) => {
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return next(new BadRequestError("No image files provided"));
    }

    // Find item
    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!item) {
      // Delete uploaded files if item not found
      req.files.forEach((file) => deleteFile(file.path));
      return next(new NotFoundError("Item not found"));
    }

    // Process uploaded files
    const imageUrls = [];
    const filenames = [];

    for (const file of req.files) {
      const imageUrl = getFileUrl(req, file.filename);
      imageUrls.push(imageUrl);
      filenames.push(file.filename);
      item.images.push(imageUrl);
    }

    await item.save();

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: item._id,
      resourceType: "item",
      action: "add_multiple_images",
      details: {
        name: item.name,
        imageUrls,
        filenames,
        count: req.files.length,
      },
    });

    return ApiResponse.success(res, "Images added successfully", {
      item,
      imageUrls,
      filenames,
      count: req.files.length,
    });
  } catch (error) {
    // Delete uploaded files on error
    if (req.files) {
      req.files.forEach((file) => deleteFile(file.path));
    }
    next(error);
  }
};

/**
 * @desc    Advanced search items
 * @route   GET /api/items/search
 * @access  Private
 */
exports.searchItems = async (req, res, next) => {
  try {
    const {
      q, // General search query
      name,
      description,
      tags,
      folderId,
      folders, // Support for multiple folders
      minQuantity,
      maxQuantity,
      minPrice,
      maxPrice,
      lowStock,
      hasImages,
      barcode,
      sku,
      location,
      sortBy,
      sortOrder,
      page = 1,
      limit = 20,
    } = req.query;

    // Build query
    const query = { userId: req.user.id };

    // General text search
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ];
    }

    // Specific field searches
    if (name) {
      query.name = { $regex: name, $options: "i" };
    }

    if (description) {
      query.description = { $regex: description, $options: "i" };
    }

    if (tags) {
      let tagArray;
      if (Array.isArray(tags)) {
        // If tags is already an array (from query params like tags[])
        tagArray = tags
          .filter((tag) => tag && tag.trim())
          .map((tag) => tag.trim());
      } else {
        // If tags is a string (comma-separated)
        tagArray = tags.split(",").map((tag) => tag.trim());
      }
      if (tagArray.length > 0) {
        query.tags = { $in: tagArray };
      }
    }

    // Folder filter
    if (folders && Array.isArray(folders) && folders.length > 0) {
      // Handle multiple folders (folders[])
      const validFolders = folders.filter((f) => f && f !== "null");
      const hasNull = folders.includes("null") || folders.includes(null);

      if (validFolders.length > 0 && hasNull) {
        // Include both specific folders and items with no folder
        query.$or = [{ folderId: { $in: validFolders } }, { folderId: null }];
      } else if (validFolders.length > 0) {
        // Only specific folders
        query.folderId = { $in: validFolders };
      } else if (hasNull) {
        // Only items with no folder
        query.folderId = null;
      }
    } else if (folderId) {
      // Handle single folder (backward compatibility)
      if (folderId === "null") {
        query.folderId = null;
      } else {
        query.folderId = folderId;
      }
    }

    // Quantity range filter
    if (
      (minQuantity !== undefined && minQuantity !== "") ||
      (maxQuantity !== undefined && maxQuantity !== "")
    ) {
      query.quantity = {};
      if (minQuantity !== undefined && minQuantity !== "") {
        const minQty = parseFloat(minQuantity);
        if (!isNaN(minQty)) {
          query.quantity.$gte = minQty;
        }
      }
      if (maxQuantity !== undefined && maxQuantity !== "") {
        const maxQty = parseFloat(maxQuantity);
        if (!isNaN(maxQty)) {
          query.quantity.$lte = maxQty;
        }
      }
    }

    // Price range filter
    if (
      (minPrice !== undefined && minPrice !== "") ||
      (maxPrice !== undefined && maxPrice !== "")
    ) {
      query.price = {};
      if (minPrice !== undefined && minPrice !== "") {
        const minPr = parseFloat(minPrice);
        if (!isNaN(minPr)) {
          query.price.$gte = minPr;
        }
      }
      if (maxPrice !== undefined && maxPrice !== "") {
        const maxPr = parseFloat(maxPrice);
        if (!isNaN(maxPr)) {
          query.price.$lte = maxPr;
        }
      }
    }

    // Low stock filter
    if (lowStock === "true") {
      query.$expr = { $lte: ["$quantity", "$minLevel"] };
    }

    // Has images filter
    if (hasImages === "true") {
      query.images = { $exists: true, $not: { $size: 0 } };
    }

    // Barcode filter
    if (barcode) {
      query.barcode = { $regex: barcode, $options: "i" };
    }

    // SKU filter
    if (sku) {
      query.sku = { $regex: sku, $options: "i" };
    }

    // Location filter
    if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;

    // Sort
    let sortOptions = {};
    if (sortBy) {
      const order = sortOrder === "desc" ? -1 : 1;
      sortOptions[sortBy] = order;
    } else {
      sortOptions = { createdAt: -1 };
    }

    // Execute query
    const items = await Item.find(query)
      .sort(sortOptions)
      .skip(startIndex)
      .limit(limitNum)
      .populate("folderId", "name");

    // Get total count
    const total = await Item.countDocuments(query);

    // Calculate aggregations
    const aggregations = await Item.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ["$quantity", "$price"] } },
          totalQuantity: { $sum: "$quantity" },
          avgPrice: { $avg: "$price" },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ["$quantity", "$minLevel"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const stats = aggregations[0] || {
      totalValue: 0,
      totalQuantity: 0,
      avgPrice: 0,
      lowStockCount: 0,
    };

    return ApiResponse.success(res, "Search completed successfully", {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      stats,
      query: req.query,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get item statistics
 * @route   GET /api/items/stats
 * @access  Private
 */
exports.getItemStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get basic stats
    const stats = await Item.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$quantity", "$price"] } },
          totalQuantity: { $sum: "$quantity" },
          avgPrice: { $avg: "$price" },
          avgQuantity: { $avg: "$quantity" },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ["$quantity", "$minLevel"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Get category stats (by folder)
    const categoryStats = await Item.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$folderId",
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$quantity", "$price"] } },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      {
        $lookup: {
          from: "folders",
          localField: "_id",
          foreignField: "_id",
          as: "folder",
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          totalValue: 1,
          totalQuantity: 1,
          folderName: { $arrayElemAt: ["$folder.name", 0] },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get top tags
    const tagStats = await Item.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const basicStats = stats[0] || {
      totalItems: 0,
      totalValue: 0,
      totalQuantity: 0,
      avgPrice: 0,
      avgQuantity: 0,
      lowStockCount: 0,
    };

    return ApiResponse.success(res, "Statistics retrieved successfully", {
      basic: basicStats,
      categories: categoryStats,
      topTags: tagStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get item activities
 * @route   GET /api/items/:id/activities
 * @access  Private
 */
exports.getItemActivities = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Verify item exists and user has access
    const item = await Item.findOne({
      _id: id,
      userId: req.user.id,
    });

    if (!item) {
      return next(new NotFoundError("Item not found"));
    }

    // Get activities for this item
    const activities = await Activity.find({
      resourceId: id,
      resourceType: "item",
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("userId", "name email")
      .lean();

    // Get total count
    const total = await Activity.countDocuments({
      resourceId: id,
      resourceType: "item",
    });

    return ApiResponse.success(res, "Item activities retrieved successfully", {
      activities,
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

/**
 * @desc    Bulk update items
 * @route   PUT /api/items/bulk
 * @access  Private
 */
exports.bulkUpdateItems = async (req, res, next) => {
  try {
    const { itemIds, updates } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return next(new BadRequestError("Item IDs are required"));
    }

    if (!updates || Object.keys(updates).length === 0) {
      return next(new BadRequestError("Updates are required"));
    }

    // Update items
    const result = await Item.updateMany(
      {
        _id: { $in: itemIds },
        userId: req.user.id,
      },
      { $set: updates },
      { runValidators: true }
    );

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: req.user.id, // Use user ID as resource ID for bulk operations
      resourceType: "user",
      action: "bulk_update",
      details: {
        itemIds,
        updates,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });

    return ApiResponse.success(res, "Items updated successfully", {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Find item by barcode
 * @route   GET /api/items/barcode/:barcode
 * @access  Private
 */
exports.findItemByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;

    const item = await Item.findOne({
      barcode: barcode,
      userId: req.user.id,
      isDeleted: false,
    }).populate("folderId", "name");

    if (!item) {
      throw new NotFoundError("Item not found");
    }

    res.json(ApiResponse.success("Item found", item));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search items by barcode or name
 * @route   GET /api/items/search/barcode
 * @access  Private
 */
exports.searchItemsByBarcode = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      throw new BadRequestError("Search query is required");
    }

    const searchRegex = new RegExp(q, "i");

    const items = await Item.find({
      userId: req.user.id,
      isDeleted: false,
      $or: [
        { barcode: searchRegex },
        { name: searchRegex },
        { sku: searchRegex },
      ],
    })
      .populate("folderId", "name")
      .limit(20)
      .sort({ updatedAt: -1 });

    res.json(ApiResponse.success("Search results", items));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate barcode for item
 * @route   POST /api/items/:id/barcode
 * @access  Private
 */
exports.generateItemBarcode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = "CODE_128" } = req.body;

    const item = await Item.findOne({
      _id: id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!item) {
      throw new NotFoundError("Item not found");
    }

    // Generate a unique barcode based on item ID and timestamp
    const timestamp = Date.now().toString();
    const itemIdStr = item._id.toString().slice(-6);
    let generatedBarcode;

    switch (format) {
      case "UPC_A":
        generatedBarcode = `0${itemIdStr}${timestamp.slice(-5)}`;
        break;
      case "EAN_13":
        generatedBarcode = `${itemIdStr}${timestamp.slice(-7)}`;
        break;
      case "CODE_128":
      default:
        generatedBarcode = `ITEM${itemIdStr}${timestamp.slice(-6)}`;
        break;
    }

    // Update item with new barcode
    if (item.barcode) {
      // Add current barcode to history
      item.barcodeHistory.push({
        barcode: item.barcode,
        format: item.barcodeFormat,
        createdBy: req.user.id,
      });
    }

    item.barcode = generatedBarcode;
    item.barcodeFormat = format;
    await item.save();

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: item._id,
      resourceType: "item",
      action: "update",
      details: {
        field: "barcode",
        newValue: generatedBarcode,
        format: format,
      },
    });

    res.json(
      ApiResponse.success("Barcode generated successfully", {
        barcode: generatedBarcode,
        format: format,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update item barcode
 * @route   PATCH /api/items/:id/barcode
 * @access  Private
 */
exports.updateItemBarcode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { barcode, format } = req.body;

    if (!barcode) {
      throw new BadRequestError("Barcode is required");
    }

    // Check if barcode already exists for another item
    const existingItem = await Item.findOne({
      barcode: barcode,
      userId: req.user.id,
      _id: { $ne: id },
      isDeleted: false,
    });

    if (existingItem) {
      throw new BadRequestError("Barcode already exists for another item");
    }

    const item = await Item.findOne({
      _id: id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!item) {
      throw new NotFoundError("Item not found");
    }

    // Add current barcode to history if it exists
    if (item.barcode) {
      item.barcodeHistory.push({
        barcode: item.barcode,
        format: item.barcodeFormat,
        createdBy: req.user.id,
      });
    }

    const oldBarcode = item.barcode;
    item.barcode = barcode;
    if (format) {
      item.barcodeFormat = format;
    }

    await item.save();

    // Log activity
    await Activity.create({
      userId: req.user.id,
      resourceId: item._id,
      resourceType: "item",
      action: "update",
      details: {
        field: "barcode",
        oldValue: oldBarcode,
        newValue: barcode,
        format: format,
      },
    });

    res.json(ApiResponse.success("Barcode updated successfully", item));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get barcode history for item
 * @route   GET /api/items/:id/barcode/history
 * @access  Private
 */
exports.getItemBarcodeHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await Item.findOne({
      _id: id,
      userId: req.user.id,
      isDeleted: false,
    })
      .populate("barcodeHistory.createdBy", "name email")
      .select("barcodeHistory barcode barcodeFormat");

    if (!item) {
      throw new NotFoundError("Item not found");
    }

    const history = [
      // Current barcode
      {
        barcode: item.barcode,
        format: item.barcodeFormat,
        createdAt: item.updatedAt,
        isCurrent: true,
      },
      // Historical barcodes
      ...item.barcodeHistory.map((h) => ({
        barcode: h.barcode,
        format: h.format,
        createdAt: h.createdAt,
        createdBy: h.createdBy,
        isCurrent: false,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(ApiResponse.success("Barcode history retrieved", history));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk delete items
 * @route   DELETE /api/items/bulk
 * @access  Private
 */
exports.bulkDeleteItems = async (req, res, next) => {
  try {
    const { itemIds, reason = "Bulk delete operation" } = req.body;

    console.log("🔍 Bulk delete debug:");
    console.log("  - req.body:", req.body);
    console.log("  - itemIds:", itemIds);
    console.log("  - req.user:", req.user);

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return next(new BadRequestError("Item IDs array is required"));
    }

    // Validate all item IDs
    const validItemIds = itemIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (validItemIds.length !== itemIds.length) {
      return next(new BadRequestError("Invalid item ID format"));
    }

    // Find items that belong to the user
    const items = await Item.find({
      _id: { $in: validItemIds },
      userId: req.user.id,
    });

    if (items.length === 0) {
      return next(new NotFoundError("No items found to delete"));
    }

    // Check if user has permission to delete all items
    const unauthorizedItems = items.filter(
      (item) => item.userId.toString() !== req.user.id.toString()
    );
    if (unauthorizedItems.length > 0) {
      console.log("🔍 Unauthorized items debug:");
      console.log("  - req.user.id:", req.user.id);
      console.log("  - req.user.id type:", typeof req.user.id);
      console.log("  - Sample item.userId:", items[0]?.userId);
      console.log("  - Sample item.userId type:", typeof items[0]?.userId);
      console.log("  - Unauthorized items count:", unauthorizedItems.length);
      return next(
        new ForbiddenError("Insufficient permissions to delete some items")
      );
    }

    // Delete all items
    const deleteResult = await Item.deleteMany({
      _id: { $in: items.map((item) => item._id) },
      userId: req.user.id,
    });

    // Log activity for each deleted item
    const activityPromises = items.map((item) =>
      Activity.logItemActivity(req.user.id, item._id, "delete", {
        itemName: item.name,
        reason,
        bulkOperation: true,
        deletedAt: new Date(),
      })
    );

    await Promise.all(activityPromises);

    return ApiResponse.success(res, "Items deleted successfully", {
      deletedCount: deleteResult.deletedCount,
      requestedCount: itemIds.length,
      foundCount: items.length,
      deletedItems: items.map((item) => ({
        id: item._id,
        name: item.name,
      })),
    });
  } catch (error) {
    next(error);
  }
};
