const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  getUserStats,
} = require("../controllers/userController");
const { authenticateToken } = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

// User CRUD routes
router.get("/", getUsers);
router.get("/stats", getUserStats);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.post("/bulk-delete", bulkDeleteUsers);

module.exports = router;
