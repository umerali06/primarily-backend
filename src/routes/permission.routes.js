const express = require("express");
const { body, param, query } = require("express-validator");
const router = express.Router();
const permissionController = require("../controllers/permission.controller");
const { protect } = require("../middleware/auth");
const { checkPermissionManagement } = require("../middleware/permission");
const validate = require("../middleware/validate");

// Validation middleware
const validateResourceType = param("resourceType")
  .isIn(["item", "folder"])
  .withMessage("Resource type must be either item or folder");

const validateResourceId = param("resourceId")
  .isMongoId()
  .withMessage("Invalid resource ID");

const validateAccessLevel = body("accessLevel")
  .isIn(["view", "edit", "admin"])
  .withMessage("Access level must be view, edit, or admin");

const validateUserEmail = body("userEmail")
  .isEmail()
  .withMessage("Valid email is required");

const validateGrantPermission = [
  body("resourceId").isMongoId().withMessage("Invalid resource ID"),
  body("resourceType")
    .isIn(["item", "folder"])
    .withMessage("Resource type must be either item or folder"),
  validateUserEmail,
  validateAccessLevel,
  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("Expires at must be a valid date"),
];

const validateUpdatePermission = [
  body("accessLevel")
    .optional()
    .isIn(["view", "edit", "admin"])
    .withMessage("Access level must be view, edit, or admin"),
  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("Expires at must be a valid date"),
];

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/permissions/user
 * @desc    Get current user's permissions
 * @access  Private
 */
router.get("/user", permissionController.getUserPermissions);

/**
 * @route   GET /api/permissions/:resourceType/:resourceId
 * @desc    Get permissions for a specific resource
 * @access  Private (requires admin permission or ownership)
 */
router.get(
  "/:resourceType/:resourceId",
  [validateResourceType, validateResourceId],
  validate,
  // Check if user can manage permissions for this resource
  (req, res, next) => {
    const { resourceType } = req.params;
    return checkPermissionManagement(resourceType.toLowerCase(), "resourceId")(
      req,
      res,
      next
    );
  },
  permissionController.getResourcePermissions
);

/**
 * @route   POST /api/permissions
 * @desc    Grant permission to a user
 * @access  Private (requires admin permission or ownership)
 */
router.post(
  "/",
  validateGrantPermission,
  validate,
  // Check if user can manage permissions for this resource
  (req, res, next) => {
    const { resourceType } = req.body;
    return checkPermissionManagement(resourceType.toLowerCase())(
      req,
      res,
      next
    );
  },
  permissionController.grantPermission
);

/**
 * @route   PUT /api/permissions/:id
 * @desc    Update a permission
 * @access  Private (requires admin permission or ownership)
 */
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid permission ID"),
    ...validateUpdatePermission,
  ],
  validate,
  // Note: Permission management check is handled in the controller
  // since we need to look up the permission first to get resource details
  permissionController.updatePermission
);

/**
 * @route   DELETE /api/permissions/:id
 * @desc    Revoke a permission by ID
 * @access  Private (requires admin permission or ownership)
 */
router.delete(
  "/:id",
  param("id").isMongoId().withMessage("Invalid permission ID"),
  validate,
  // Note: Permission management check is handled in the controller
  permissionController.revokePermission
);

/**
 * @route   DELETE /api/permissions/:resourceType/:resourceId/user/:userEmail
 * @desc    Revoke permission for a specific user on a resource
 * @access  Private (requires admin permission or ownership)
 */
router.delete(
  "/:resourceType/:resourceId/user/:userEmail",
  [
    validateResourceType,
    validateResourceId,
    param("userEmail").isEmail().withMessage("Valid email is required"),
  ],
  validate,
  // Check if user can manage permissions for this resource
  (req, res, next) => {
    const { resourceType } = req.params;
    return checkPermissionManagement(resourceType.toLowerCase(), "resourceId")(
      req,
      res,
      next
    );
  },
  permissionController.revokeUserPermission
);

/**
 * @route   GET /api/permissions/check/:resourceType/:resourceId
 * @desc    Check if current user has permission for a resource
 * @access  Private
 */
router.get(
  "/check/:resourceType/:resourceId",
  [
    validateResourceType,
    validateResourceId,
    query("accessLevel")
      .optional()
      .isIn(["view", "edit", "admin"])
      .withMessage("Access level must be view, edit, or admin"),
  ],
  validate,
  permissionController.checkPermission
);

module.exports = router;
