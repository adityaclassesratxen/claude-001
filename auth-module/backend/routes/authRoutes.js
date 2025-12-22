const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

const {
  register,
  login,
  forgotPassword,
  validateResetToken,
  resetPassword,
} = require("../controllers/authController");

// Existing routes
router.post("/register", register);
router.post("/login", login);

// New password reset routes
router.post("/forgot-password", forgotPassword);
router.get("/validate-reset-token/:token", validateResetToken);
router.post("/reset-password", resetPassword);

module.exports = router;
