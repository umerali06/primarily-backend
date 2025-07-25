const mongoose = require("mongoose");
const Folder = require("../models/folder.model");
const User = require("../models/user.model");

describe("Folder Model", () => {
  let userId;

  beforeAll(async () => {
    // Connect to a test database
    await mongoose.connect("mongodb://localhost:27017/test_db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Create a test user
    const user = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    userId = user._id;
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Folder.deleteMany({});

    // Disconnect from the test database
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear the Folder collection before each test
    await Folder.deleteMany({});
  });

  it("should create a new folder", async () => {
    const folderData = {
      name: "Test Folder",
      description: "This is a test folder",
      userId,
    };

    const folder = await Folder.create(folderData);

    expect(folder).toBeDefined();
    expect(folder.name).toBe(folderData.name);
    expect(folder.description).toBe(folderData.description);
    expect(folder.userId.toString()).toBe(userId.toString());
    expect(folder.parentId).toBeNull();
    expect(folder.path).toBe("");
    expect(folder.level).toBe(1);
  });

  it("should create a folder hierarchy", async () => {
    // Create parent folder
    const parentFolder = await Folder.create({
      name: "Parent Folder",
      userId,
    });

    // Create child folder
    const childFolder = await Folder.create({
      name: "Child Folder",
      parentId: parentFolder._id,
      userId,
    });

    // Create grandchild folder
    const grandchildFolder = await Folder.create({
      name: "Grandchild Folder",
      parentId: childFolder._id,
      userId,
    });

    // Verify parent folder
    expect(parentFolder.parentId).toBeNull();
    expect(parentFolder.path).toBe("");
    expect(parentFolder.level).toBe(1);

    // Verify child folder
    expect(childFolder.parentId.toString()).toBe(parentFolder._id.toString());
    expect(childFolder.path).toBe(`/${parentFolder._id}`);
    expect(childFolder.level).toBe(2);

    // Verify grandchild folder
    expect(grandchildFolder.parentId.toString()).toBe(
      childFolder._id.toString()
    );
    expect(grandchildFolder.path).toBe(
      `/${parentFolder._id}/${childFolder._id}`
    );
    expect(grandchildFolder.level).toBe(3);
  });

  it("should detect circular references", async () => {
    // Create parent folder
    const parentFolder = await Folder.create({
      name: "Parent Folder",
      userId,
    });

    // Create child folder
    const childFolder = await Folder.create({
      name: "Child Folder",
      parentId: parentFolder._id,
      userId,
    });

    // Try to make parent a child of its child (circular reference)
    parentFolder.parentId = childFolder._id;

    await expect(parentFolder.save()).rejects.toThrow(
      "Cannot move a folder to its own descendant"
    );
  });

  it("should prevent a folder from being its own parent", async () => {
    // Create folder
    const folder = await Folder.create({
      name: "Test Folder",
      userId,
    });

    // Try to make folder its own parent
    folder.parentId = folder._id;

    await expect(folder.save()).rejects.toThrow(
      "Folder cannot be its own parent"
    );
  });

  it("should update path when moving folders", async () => {
    // Create initial hierarchy
    const folder1 = await Folder.create({
      name: "Folder 1",
      userId,
    });

    const folder2 = await Folder.create({
      name: "Folder 2",
      userId,
    });

    const folder1Child = await Folder.create({
      name: "Folder 1 Child",
      parentId: folder1._id,
      userId,
    });

    const folder1Grandchild = await Folder.create({
      name: "Folder 1 Grandchild",
      parentId: folder1Child._id,
      userId,
    });

    // Move folder1Child to folder2
    folder1Child.parentId = folder2._id;
    await folder1Child.save();

    // Reload folders to get updated paths
    const updatedFolder1Child = await Folder.findById(folder1Child._id);
    const updatedFolder1Grandchild = await Folder.findById(
      folder1Grandchild._id
    );

    // Verify paths are updated
    expect(updatedFolder1Child.path).toBe(`/${folder2._id}`);
    expect(updatedFolder1Child.level).toBe(2);
    expect(updatedFolder1Grandchild.path).toBe(
      `/${folder2._id}/${folder1Child._id}`
    );
    expect(updatedFolder1Grandchild.level).toBe(3);
  });

  it("should check if a folder is a child of another folder", async () => {
    // Create hierarchy
    const parent = await Folder.create({
      name: "Parent",
      userId,
    });

    const child = await Folder.create({
      name: "Child",
      parentId: parent._id,
      userId,
    });

    const grandchild = await Folder.create({
      name: "Grandchild",
      parentId: child._id,
      userId,
    });

    const unrelated = await Folder.create({
      name: "Unrelated",
      userId,
    });

    // Check relationships
    expect(child.isChildOf(parent._id.toString())).toBe(true);
    expect(grandchild.isChildOf(parent._id.toString())).toBe(true);
    expect(grandchild.isChildOf(child._id.toString())).toBe(true);
    expect(parent.isChildOf(child._id.toString())).toBe(false);
    expect(unrelated.isChildOf(parent._id.toString())).toBe(false);
  });

  it("should require a name", async () => {
    const folderData = {
      description: "This is a test folder",
      userId,
    };

    await expect(Folder.create(folderData)).rejects.toThrow();
  });

  it("should require a user ID", async () => {
    const folderData = {
      name: "Test Folder",
      description: "This is a test folder",
    };

    await expect(Folder.create(folderData)).rejects.toThrow();
  });
});
