const express = require("express");
const router = express.Router();
const {
  getTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  getItemsByTag,
  getTagStats,
} = require("../controllers/tag.controller");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { body, param } = require("express-validator");

// Validation rules
const createTagValidation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Tag name must be between 1 and 50 characters"),
  body("color")
    .optional()
    .isIn([
      "red",
      "blue",
      "green",
      "yellow",
      "purple",
      "pink",
      "gray",
      "orange",
    ])
    .withMessage("Invalid color"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),
];

const updateTagValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Tag name must be between 1 and 50 characters"),
  body("color")
    .optional()
    .isIn([
      "red",
      "blue",
      "green",
      "yellow",
      "purple",
      "pink",
      "gray",
      "orange",
    ])
    .withMessage("Invalid color"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),
];

const idValidation = [param("id").isMongoId().withMessage("Invalid tag ID")];

const tagNameValidation = [
  param("tagName")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Tag name is required"),
];

// Routes
router.get("/", protect, getTags);
router.get("/stats", protect, getTagStats);
router.get("/:id", protect, idValidation, validate, getTag);
router.post("/", protect, createTagValidation, validate, createTag);
router.put(
  "/:id",
  protect,
  idValidation,
  updateTagValidation,
  validate,
  updateTag
);
router.delete("/:id", protect, idValidation, validate, deleteTag);
router.get(
  "/:tagName/items",
  protect,
  tagNameValidation,
  validate,
  getItemsByTag
);

module.exports = router;
