const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const tagsController = require("../controllers/tags.controller");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");

// Validation rules
const createTagValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Tag name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "Tag name can only contain letters, numbers, spaces, hyphens, and underscores"
    ),

  body("color")
    .optional()
    .isIn([
      "gray",
      "red",
      "blue",
      "green",
      "yellow",
      "purple",
      "pink",
      "orange",
    ])
    .withMessage("Invalid color value"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description cannot exceed 200 characters"),
];

const updateTagValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Tag name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "Tag name can only contain letters, numbers, spaces, hyphens, and underscores"
    ),

  body("color")
    .optional()
    .isIn([
      "gray",
      "red",
      "blue",
      "green",
      "yellow",
      "purple",
      "pink",
      "orange",
    ])
    .withMessage("Invalid color value"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description cannot exceed 200 characters"),
];

// Apply authentication to all routes
router.use(protect);

// GET /api/tags - Get all tags
router.get("/", tagsController.getTags);

// GET /api/tags/:id - Get tag by ID
router.get("/:id", tagsController.getTag);

// POST /api/tags - Create new tag
router.post("/", createTagValidation, validate, tagsController.createTag);

// PUT /api/tags/:id - Update tag
router.put("/:id", updateTagValidation, validate, tagsController.updateTag);

// DELETE /api/tags/:id - Delete tag
router.delete("/:id", tagsController.deleteTag);

// GET /api/tags/:name/items - Get items by tag name
router.get("/:name/items", tagsController.getItemsByTag);

// GET /api/tags/stats - Get tag statistics
router.get("/stats", tagsController.getTagStats);

module.exports = router;
