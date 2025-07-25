const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { BadRequestError } = require("../utils/customError");
const {
  generateOptimizedFilename,
  validateImage,
} = require("../utils/imageProcessor");
const config = require("../config");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../", config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subdirectory for items
    const itemsDir = path.join(uploadDir, "items");
    if (!fs.existsSync(itemsDir)) {
      fs.mkdirSync(itemsDir, { recursive: true });
    }
    cb(null, itemsDir);
  },
  filename: (req, file, cb) => {
    // Generate optimized filename
    const filename = generateOptimizedFilename(file.originalname);
    cb(null, `item-${filename}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new BadRequestError("Only image files are allowed"), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Middleware for single image upload
const uploadSingle = (fieldName = "image") => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);

    singleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new BadRequestError("File too large. Maximum size is 5MB")
          );
        }
        return next(new BadRequestError(`Upload error: ${err.message}`));
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
};

// Middleware for multiple image upload
const uploadMultiple = (fieldName = "images", maxCount = 5) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);

    multipleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new BadRequestError("File too large. Maximum size is 5MB")
          );
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(
            new BadRequestError(`Too many files. Maximum is ${maxCount}`)
          );
        }
        return next(new BadRequestError(`Upload error: ${err.message}`));
      } else if (err) {
        return next(err);
      }
      next();
    });
  };
};

// Helper function to delete file
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
};

// Helper function to get file URL
const getFileUrl = (req, filename) => {
  return `${req.protocol}://${req.get("host")}/uploads/items/${filename}`;
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  deleteFile,
  getFileUrl,
};
