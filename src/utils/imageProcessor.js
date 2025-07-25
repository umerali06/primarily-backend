const fs = require("fs");
const path = require("path");

/**
 * Simple image processing utilities
 * Note: For production use, consider using libraries like sharp or jimp
 * for more advanced image processing capabilities
 */

/**
 * Get image dimensions from file (basic implementation)
 * @param {string} filePath - Path to image file
 * @returns {Object} - Image dimensions
 */
const getImageDimensions = (filePath) => {
  try {
    // This is a basic implementation
    // In production, use a proper image processing library
    const stats = fs.statSync(filePath);
    return {
      width: null, // Would be determined by image processing library
      height: null, // Would be determined by image processing library
      size: stats.size,
    };
  } catch (error) {
    console.error("Error getting image dimensions:", error);
    return null;
  }
};

/**
 * Validate image file
 * @param {Object} file - Multer file object
 * @returns {Object} - Validation result
 */
const validateImage = (file) => {
  const errors = [];

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push("File size exceeds 5MB limit");
  }

  // Check file type
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.mimetype)) {
    errors.push("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed");
  }

  // Check file extension
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    errors.push("Invalid file extension");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Generate thumbnail filename
 * @param {string} originalFilename - Original filename
 * @returns {string} - Thumbnail filename
 */
const getThumbnailFilename = (originalFilename) => {
  const ext = path.extname(originalFilename);
  const name = path.basename(originalFilename, ext);
  return `${name}_thumb${ext}`;
};

/**
 * Create image metadata
 * @param {Object} file - Multer file object
 * @param {string} imageUrl - Image URL
 * @returns {Object} - Image metadata
 */
const createImageMetadata = (file, imageUrl) => {
  const dimensions = getImageDimensions(file.path);

  return {
    url: imageUrl,
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    dimensions: dimensions,
    uploadedAt: new Date(),
  };
};

/**
 * Clean up temporary files
 * @param {Array} files - Array of file paths to clean up
 */
const cleanupFiles = (files) => {
  files.forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  });
};

/**
 * Generate optimized filename
 * @param {string} originalName - Original filename
 * @returns {string} - Optimized filename
 */
const generateOptimizedFilename = (originalName) => {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName).toLowerCase();

  // Remove special characters and spaces
  const cleanName = path
    .basename(originalName, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${cleanName}-${timestamp}-${random}${ext}`;
};

module.exports = {
  getImageDimensions,
  validateImage,
  getThumbnailFilename,
  createImageMetadata,
  cleanupFiles,
  generateOptimizedFilename,
};
