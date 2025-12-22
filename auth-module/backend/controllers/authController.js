const { sendEmail } = require("../services/emailService");
const {
  generateResetToken,
  getTokenExpiry,
} = require("../utils/tokenGenerator");
const pool = require("../db");
const bcrypt = require("bcrypt");

// Forgot Password - Send reset email
const forgotPassword = async (req, res) => {
  const client = await pool.connect();

  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if user exists
    const userQuery = "SELECT id, email, name FROM users WHERE email = $1";
    const userResult = await client.query(userQuery, [email]);

    // Always return success (security: don't reveal if email exists)
    if (userResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "If that email exists, a reset link has been sent",
      });
    }

    const user = userResult.rows[0];

    // Generate reset token
    const resetToken = generateResetToken();
    const tokenExpiry = getTokenExpiry();

    // Save token to database
    const updateQuery = `
      UPDATE users 
      SET reset_token = $1, reset_token_expiry = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3
    `;
    await client.query(updateQuery, [resetToken, tokenExpiry, user.id]);

    // Create reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send email
    await sendEmail(user.email, "resetPassword", {
      resetLink,
      userName: user.name,
    });

    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process password reset request",
    });
  } finally {
    client.release();
  }
};

// Validate Reset Token
const validateResetToken = async (req, res) => {
  const client = await pool.connect();

  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    // Check token validity
    const query = `
      SELECT id, email, name 
      FROM users 
      WHERE reset_token = $1 
      AND reset_token_expiry > CURRENT_TIMESTAMP
    `;
    const result = await client.query(query, [token]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    res.status(200).json({
      success: true,
      message: "Token is valid",
      user: {
        email: result.rows[0].email,
        name: result.rows[0].name,
      },
    });
  } catch (error) {
    console.error("Token validation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate token",
    });
  } finally {
    client.release();
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const client = await pool.connect();

  try {
    const { token, newPassword } = req.body;

    // Validation
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
    }

    // Password strength validation
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      });
    }

    // Find user with valid token
    const userQuery = `
      SELECT id, email 
      FROM users 
      WHERE reset_token = $1 
      AND reset_token_expiry > CURRENT_TIMESTAMP
    `;
    const userResult = await client.query(userQuery, [token]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    const user = userResult.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    const updateQuery = `
      UPDATE users 
      SET password = $1, reset_token = NULL, reset_token_expiry = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `;
    await client.query(updateQuery, [hashedPassword, user.id]);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  // ... existing functions (register, login, etc.)
  forgotPassword,
  validateResetToken,
  resetPassword,
};
