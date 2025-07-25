const Item = require("../models/item.model");
const Folder = require("../models/folder.model");
const Activity = require("../models/activity.model");
const ApiResponse = require("../utils/apiResponse");
const { BadRequestError } = require("../utils/customError");
const csv = require("csv-parser");
const fs = require("fs");
const mongoose = require("mongoose");

/**
 * @desc    Import items from CSV
 * @route   POST /api/import/items/csv
 * @access  Private
 */
exports.importItemsCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new BadRequestError("CSV file is required"));
    }

    const { duplicateAction = "skip" } = req.body; // skip, update, or error
    const results = [];
    const errors = [];
    let processed = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Read and parse CSV file
    const csvData = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (data) => csvData.push(data))
        .on("end", resolve)
        .on("error", reject);
    });

    // Process each row
    for (const row of csvData) {
      processed++;

      try {
        // Validate required fields
        if (!row.name || !row.name.trim()) {
          errors.push({
            row: processed,
            error: "Name is required",
            data: row,
          });
          continue;
        }

        // Check for existing item
        const existingItem = await Item.findOne({
          name: row.name.trim(),
          userId: req.user.id,
        });

        // Handle folder lookup
        let folderId = null;
        if (row.folder && row.folder.trim() && row.folder.trim() !== "Root") {
          const folder = await Folder.findOne({
            name: row.folder.trim(),
            userId: req.user.id,
          });
          if (folder) {
            folderId = folder._id;
          }
        }

        // Prepare item data
        const itemData = {
          name: row.name.trim(),
          description: row.description || "",
          quantity: parseFloat(row.quantity) || 0,
          unit: row.unit || "",
          minLevel: parseFloat(row.minLevel) || 0,
          price: parseFloat(row.price) || 0,
          folderId,
          tags: row.tags ? row.tags.split(",").map((tag) => tag.trim()) : [],
          userId: req.user.id,
        };

        if (existingItem) {
          // Handle duplicate
          switch (duplicateAction) {
            case "skip":
              skipped++;
              results.push({
                row: processed,
                action: "skipped",
                name: row.name,
                reason: "Item already exists",
              });
              break;

            case "update":
              Object.assign(existingItem, itemData);
              await existingItem.save();
              updated++;
              results.push({
                row: processed,
                action: "updated",
                name: row.name,
                id: existingItem._id,
              });
              break;

            case "error":
              errors.push({
                row: processed,
                error: "Item already exists",
                data: row,
              });
              break;
          }
        } else {
          // Create new item
          const newItem = await Item.create(itemData);
          created++;
          results.push({
            row: processed,
            action: "created",
            name: row.name,
            id: newItem._id,
          });
        }
      } catch (error) {
        errors.push({
          row: processed,
          error: error.message,
          data: row,
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Log import activity
    await Activity.create({
      userId: req.user.id,
      action: "import_items_csv",
      details: {
        processed,
        created,
        updated,
        skipped,
        errors: errors.length,
        duplicateAction,
      },
    });

    return ApiResponse.success(res, "CSV import completed", {
      summary: {
        processed,
        created,
        updated,
        skipped,
        errors: errors.length,
      },
      results,
      errors,
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

/**
 * @desc    Import complete inventory from JSON
 * @route   POST /api/import/complete
 * @access  Private
 */
exports.importCompleteInventory = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new BadRequestError("JSON file is required"));
    }

    const { duplicateAction = "skip" } = req.body;

    // Read and parse JSON file
    const jsonData = JSON.parse(fs.readFileSync(req.file.path, "utf8"));

    if (!jsonData.folders || !jsonData.items) {
      return next(
        new BadRequestError(
          "Invalid JSON format. Expected folders and items arrays."
        )
      );
    }

    const results = {
      folders: { processed: 0, created: 0, updated: 0, skipped: 0 },
      items: { processed: 0, created: 0, updated: 0, skipped: 0 },
    };
    const errors = [];

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Import folders first (to maintain hierarchy)
      const folderIdMap = new Map(); // Map old IDs to new IDs

      for (const folderData of jsonData.folders) {
        results.folders.processed++;

        try {
          // Check for existing folder
          const existingFolder = await Folder.findOne({
            name: folderData.name,
            userId: req.user.id,
          });

          if (existingFolder) {
            if (duplicateAction === "skip") {
              results.folders.skipped++;
              folderIdMap.set(folderData.id, existingFolder._id);
              continue;
            } else if (duplicateAction === "update") {
              existingFolder.description = folderData.description;
              existingFolder.tags = folderData.tags || [];
              await existingFolder.save({ session });
              results.folders.updated++;
              folderIdMap.set(folderData.id, existingFolder._id);
              continue;
            }
          }

          // Create new folder
          const newFolder = await Folder.create(
            [
              {
                name: folderData.name,
                description: folderData.description,
                tags: folderData.tags || [],
                userId: req.user.id,
              },
            ],
            { session }
          );

          results.folders.created++;
          folderIdMap.set(folderData.id, newFolder[0]._id);
        } catch (error) {
          errors.push({
            type: "folder",
            name: folderData.name,
            error: error.message,
          });
        }
      }

      // Update folder parent relationships
      for (const folderData of jsonData.folders) {
        if (folderData.parentId && folderIdMap.has(folderData.parentId)) {
          const folderId = folderIdMap.get(folderData.id);
          const parentId = folderIdMap.get(folderData.parentId);

          if (folderId && parentId) {
            await Folder.findByIdAndUpdate(folderId, { parentId }, { session });
          }
        }
      }

      // Import items
      for (const itemData of jsonData.items) {
        results.items.processed++;

        try {
          // Check for existing item
          const existingItem = await Item.findOne({
            name: itemData.name,
            userId: req.user.id,
          });

          // Map folder ID
          let folderId = null;
          if (itemData.folderId && folderIdMap.has(itemData.folderId)) {
            folderId = folderIdMap.get(itemData.folderId);
          }

          const newItemData = {
            name: itemData.name,
            description: itemData.description,
            quantity: itemData.quantity || 0,
            unit: itemData.unit,
            minLevel: itemData.minLevel || 0,
            price: itemData.price || 0,
            folderId,
            tags: itemData.tags || [],
            userId: req.user.id,
          };

          if (existingItem) {
            if (duplicateAction === "skip") {
              results.items.skipped++;
              continue;
            } else if (duplicateAction === "update") {
              Object.assign(existingItem, newItemData);
              await existingItem.save({ session });
              results.items.updated++;
              continue;
            }
          }

          // Create new item
          await Item.create([newItemData], { session });
          results.items.created++;
        } catch (error) {
          errors.push({
            type: "item",
            name: itemData.name,
            error: error.message,
          });
        }
      }

      // Commit transaction
      await session.commitTransaction();
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Log import activity
    await Activity.create({
      userId: req.user.id,
      action: "import_complete_inventory",
      details: {
        results,
        errors: errors.length,
        duplicateAction,
      },
    });

    return ApiResponse.success(res, "Complete inventory import completed", {
      results,
      errors,
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

/**
 * @desc    Get import template
 * @route   GET /api/import/template
 * @access  Private
 */
exports.getImportTemplate = async (req, res, next) => {
  try {
    const { format = "csv" } = req.query;

    if (format === "csv") {
      // Generate CSV template
      const csvTemplate = `name,description,quantity,unit,minLevel,price,folder,tags
Sample Item 1,Description for item 1,10,pcs,5,29.99,Electronics,tag1;tag2
Sample Item 2,Description for item 2,25,kg,10,15.50,Office,tag3
Sample Item 3,Description for item 3,5,boxes,2,99.99,Storage,tag1;tag4`;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="import-template.csv"'
      );
      return res.send(csvTemplate);
    } else if (format === "xlsx") {
      // For XLSX, we'll return the same CSV content but with Excel MIME type
      const csvTemplate = `name,description,quantity,unit,minLevel,price,folder,tags
Sample Item 1,Description for item 1,10,pcs,5,29.99,Electronics,tag1;tag2
Sample Item 2,Description for item 2,25,kg,10,15.50,Office,tag3
Sample Item 3,Description for item 3,5,boxes,2,99.99,Storage,tag1;tag4`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="import-template.xlsx"'
      );
      return res.send(csvTemplate);
    } else {
      return next(new BadRequestError("Unsupported format"));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate import file
 * @route   POST /api/import/validate
 * @access  Private
 */
exports.validateImportFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new BadRequestError("File is required"));
    }

    const { type } = req.body; // csv or json
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      preview: [],
    };

    if (type === "csv") {
      // Validate CSV file
      const csvData = [];

      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on("data", (data) => csvData.push(data))
          .on("end", resolve)
          .on("error", reject);
      });

      // Check required columns
      const requiredColumns = ["name"];
      const optionalColumns = [
        "description",
        "quantity",
        "unit",
        "minLevel",
        "price",
        "folder",
        "tags",
      ];

      if (csvData.length > 0) {
        const columns = Object.keys(csvData[0]);
        const foundColumns = columns.map((col) => col.toLowerCase().trim());

        // Check for required columns
        for (const col of requiredColumns) {
          if (!foundColumns.includes(col.toLowerCase())) {
            validation.valid = false;
            validation.errors.push({
              type: "missing_column",
              column: col,
              message: `Missing required column: "${col}"`,
              suggestion: `Please ensure your CSV file has a "${col}" column header. Download the template for the correct format.`,
              foundColumns: columns,
            });
          }
        }

        // Check for empty required columns
        if (foundColumns.includes("name")) {
          const emptyNames = csvData.filter(
            (row) => !row.name || row.name.trim() === ""
          ).length;
          if (emptyNames > 0) {
            validation.warnings.push({
              type: "empty_required_field",
              message: `${emptyNames} row(s) have empty "name" field`,
              suggestion: "Items without names will be skipped during import.",
            });
          }
        }

        // Preview first 5 rows
        validation.preview = csvData.slice(0, 5);
        validation.totalRows = csvData.length;
        validation.detectedColumns = columns;

        // Check for duplicate names
        const names = csvData.map((row) => row.name).filter(Boolean);
        const duplicates = names.filter(
          (name, index) => names.indexOf(name) !== index
        );
        if (duplicates.length > 0) {
          validation.warnings.push({
            type: "duplicate_names",
            message: `Duplicate item names found: ${[
              ...new Set(duplicates),
            ].join(", ")}`,
            suggestion:
              "Duplicate handling will be based on your import settings (skip, update, or error).",
          });
        }

        // Check for unknown columns
        const unknownColumns = columns.filter(
          (col) =>
            !requiredColumns.includes(col.toLowerCase()) &&
            !optionalColumns.includes(col.toLowerCase())
        );
        if (unknownColumns.length > 0) {
          validation.warnings.push({
            type: "unknown_columns",
            message: `Unknown columns found: ${unknownColumns.join(", ")}`,
            suggestion: "These columns will be ignored during import.",
          });
        }
      } else {
        validation.valid = false;
        validation.errors.push({
          type: "empty_file",
          message: "CSV file is empty or contains no data rows",
          suggestion:
            "Please upload a CSV file with at least one data row. Download the template for reference.",
        });
      }
    } else if (type === "json") {
      // Validate JSON file
      try {
        const jsonData = JSON.parse(fs.readFileSync(req.file.path, "utf8"));

        if (!jsonData.folders || !jsonData.items) {
          validation.valid = false;
          validation.errors.push({
            type: "invalid_json_structure",
            message: "JSON file must contain 'folders' and 'items' arrays",
            suggestion:
              "Export a complete inventory to see the expected JSON format, or use CSV format instead.",
            foundStructure: Object.keys(jsonData),
          });
        } else {
          validation.preview = {
            folders: jsonData.folders.slice(0, 3),
            items: jsonData.items.slice(0, 3),
          };
          validation.totalFolders = jsonData.folders.length;
          validation.totalItems = jsonData.items.length;

          // Validate items structure
          if (jsonData.items.length > 0) {
            const firstItem = jsonData.items[0];
            if (!firstItem.name) {
              validation.warnings.push({
                type: "missing_item_names",
                message: "Some items may be missing 'name' field",
                suggestion:
                  "Items without names will be skipped during import.",
              });
            }
          }
        }
      } catch (error) {
        validation.valid = false;
        validation.errors.push({
          type: "json_parse_error",
          message: "Invalid JSON format - file cannot be parsed",
          suggestion:
            "Please check that your JSON file is properly formatted. Common issues include missing quotes, trailing commas, or invalid characters.",
          error: error.message,
        });
      }
    } else {
      validation.valid = false;
      validation.errors.push({
        type: "unsupported_file_type",
        message: `Unsupported file type: ${type}`,
        suggestion:
          "Please upload a CSV or JSON file. Use the template download for the correct format.",
      });
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    return ApiResponse.success(res, "File validation completed", validation);
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};
