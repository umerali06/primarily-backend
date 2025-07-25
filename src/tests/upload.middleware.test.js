const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  uploadSingle,
  uploadMultiple,
  deleteFile,
  getFileUrl,
} = require("../middleware/upload");
const { BadRequestError } = require("../utils/customError");

// Mock multer
jest.mock("multer");
jest.mock("fs");

describe("Upload Middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      protocol: "http",
      get: jest.fn().mockReturnValue("localhost:3000"),
      file: null,
      files: null,
    };
    res = {};
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe("uploadSingle", () => {
    it("should handle single file upload successfully", () => {
      // Mock multer.single
      const mockSingle = jest.fn().mockReturnValue((req, res, callback) => {
        req.file = {
          filename: "test-image.jpg",
          path: "/uploads/items/test-image.jpg",
          mimetype: "image/jpeg",
          size: 1024,
        };
        callback(null);
      });

      multer.mockReturnValue({
        single: mockSingle,
      });

      const middleware = uploadSingle("image");
      middleware(req, res, next);

      expect(mockSingle).toHaveBeenCalledWith("image");
      expect(req.file).toBeDefined();
      expect(next).toHaveBeenCalledWith();
    });

    it("should handle file size limit error", () => {
      // Mock multer.single with file size error
      const mockSingle = jest.fn().mockReturnValue((req, res, callback) => {
        const error = new Error("File too large");
        error.code = "LIMIT_FILE_SIZE";
        callback(error);
      });

      multer.mockReturnValue({
        single: mockSingle,
      });

      const middleware = uploadSingle("image");
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe(
        "File too large. Maximum size is 5MB"
      );
    });

    it("should handle invalid file type error", () => {
      // Mock multer.single with invalid file type
      const mockSingle = jest.fn().mockReturnValue((req, res, callback) => {
        const error = new BadRequestError("Only image files are allowed");
        callback(error);
      });

      multer.mockReturnValue({
        single: mockSingle,
      });

      const middleware = uploadSingle("image");
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe(
        "Only image files are allowed"
      );
    });
  });

  describe("uploadMultiple", () => {
    it("should handle multiple file upload successfully", () => {
      // Mock multer.array
      const mockArray = jest.fn().mockReturnValue((req, res, callback) => {
        req.files = [
          {
            filename: "test-image-1.jpg",
            path: "/uploads/items/test-image-1.jpg",
            mimetype: "image/jpeg",
            size: 1024,
          },
          {
            filename: "test-image-2.jpg",
            path: "/uploads/items/test-image-2.jpg",
            mimetype: "image/jpeg",
            size: 2048,
          },
        ];
        callback(null);
      });

      multer.mockReturnValue({
        array: mockArray,
      });

      const middleware = uploadMultiple("images", 5);
      middleware(req, res, next);

      expect(mockArray).toHaveBeenCalledWith("images", 5);
      expect(req.files).toHaveLength(2);
      expect(next).toHaveBeenCalledWith();
    });

    it("should handle too many files error", () => {
      // Mock multer.array with too many files error
      const mockArray = jest.fn().mockReturnValue((req, res, callback) => {
        const error = new Error("Too many files");
        error.code = "LIMIT_UNEXPECTED_FILE";
        callback(error);
      });

      multer.mockReturnValue({
        array: mockArray,
      });

      const middleware = uploadMultiple("images", 3);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].message).toBe(
        "Too many files. Maximum is 3"
      );
    });
  });

  describe("deleteFile", () => {
    it("should delete file successfully", () => {
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockReturnValue(undefined);

      const result = deleteFile("/path/to/file.jpg");

      expect(fs.existsSync).toHaveBeenCalledWith("/path/to/file.jpg");
      expect(fs.unlinkSync).toHaveBeenCalledWith("/path/to/file.jpg");
      expect(result).toBe(true);
    });

    it("should return false if file doesn't exist", () => {
      fs.existsSync.mockReturnValue(false);

      const result = deleteFile("/path/to/nonexistent.jpg");

      expect(fs.existsSync).toHaveBeenCalledWith("/path/to/nonexistent.jpg");
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle deletion errors", () => {
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const result = deleteFile("/path/to/file.jpg");

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("getFileUrl", () => {
    it("should generate correct file URL", () => {
      const url = getFileUrl(req, "test-image.jpg");

      expect(req.protocol).toBe("http");
      expect(req.get).toHaveBeenCalledWith("host");
      expect(url).toBe("http://localhost:3000/uploads/items/test-image.jpg");
    });
  });
});
