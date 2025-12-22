const pool = require("../config/database");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

// Get user profile
const getProfile = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.phone,
        u.department,
        u.avatar_url,
        u.bio,
        u.job_title,
        u.location,
        u.timezone,
        u.language,
        u.email_notifications,
        u.push_notifications,
        u.sms_notifications,
        u.marketing_emails,
        u.two_factor_enabled,
        u.tenant_id,
        t.name as tenant_name,
        u.last_login,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = $1 AND u.is_deleted = FALSE
    `;

    const result = await client.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  } finally {
    client.release();
  }
};

// Update profile
const updateProfile = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { name, phone, bio, job_title, location, timezone, language } =
      req.body;

    // Validation
    if (name && name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters",
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(phone);
      paramIndex++;
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramIndex}`);
      values.push(bio);
      paramIndex++;
    }

    if (job_title !== undefined) {
      updates.push(`job_title = $${paramIndex}`);
      values.push(job_title);
      paramIndex++;
    }

    if (location !== undefined) {
      updates.push(`location = $${paramIndex}`);
      values.push(location);
      paramIndex++;
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex}`);
      values.push(timezone);
      paramIndex++;
    }

    if (language !== undefined) {
      updates.push(`language = $${paramIndex}`);
      values.push(language);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const updateQuery = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, phone, bio, job_title, location, timezone, language, updated_at
    `;

    const result = await client.query(updateQuery, values);

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'profile.updated', 'user', $1, 'Updated profile information')`,
      [userId]
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  } finally {
    client.release();
  }
};

// Update avatar
const updateAvatar = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({
        success: false,
        message: "Avatar URL is required",
      });
    }

    const query = `
      UPDATE users
      SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING avatar_url
    `;

    const result = await client.query(query, [avatar_url, userId]);

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'profile.avatar_updated', 'user', $1, 'Updated profile picture')`,
      [userId]
    );

    res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update avatar",
    });
  } finally {
    client.release();
  }
};

// Change password
const changePassword = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
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

    // Get current password hash
    const userQuery = "SELECT password FROM users WHERE id = $1";
    const userResult = await client.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isValid = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await client.query(
      "UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [hashedPassword, userId]
    );

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'password.changed', 'user', $1, 'Changed password')`,
      [userId]
    );

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  } finally {
    client.release();
  }
};

// Update preferences
const updatePreferences = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const {
      email_notifications,
      push_notifications,
      sms_notifications,
      marketing_emails,
    } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (email_notifications !== undefined) {
      updates.push(`email_notifications = $${paramIndex}`);
      values.push(email_notifications);
      paramIndex++;
    }

    if (push_notifications !== undefined) {
      updates.push(`push_notifications = $${paramIndex}`);
      values.push(push_notifications);
      paramIndex++;
    }

    if (sms_notifications !== undefined) {
      updates.push(`sms_notifications = $${paramIndex}`);
      values.push(sms_notifications);
      paramIndex++;
    }

    if (marketing_emails !== undefined) {
      updates.push(`marketing_emails = $${paramIndex}`);
      values.push(marketing_emails);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No preferences to update",
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING email_notifications, push_notifications, sms_notifications, marketing_emails
    `;

    const result = await client.query(query, values);

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'preferences.updated', 'user', $1, 'Updated notification preferences')`,
      [userId]
    );

    res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update preferences",
    });
  } finally {
    client.release();
  }
};

// Get login history
const getLoginHistory = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery =
      "SELECT COUNT(*) as total FROM login_history WHERE user_id = $1";
    const countResult = await client.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].total);

    // Get login history
    const historyQuery = `
      SELECT 
        id,
        login_at,
        ip_address,
        device,
        browser,
        os,
        location,
        success,
        failure_reason,
        logout_at
      FROM login_history
      WHERE user_id = $1
      ORDER BY login_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await client.query(historyQuery, [userId, limit, offset]);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get login history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch login history",
    });
  } finally {
    client.release();
  }
};

// Get activity log
const getActivityLog = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, action = "" } = req.query;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = "WHERE user_id = $1";
    const params = [userId];
    let paramIndex = 2;

    if (action) {
      whereClause += ` AND action ILIKE $${paramIndex}`;
      params.push(`%${action}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM activity_log ${whereClause}`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get activity log
    params.push(limit, offset);
    const logQuery = `
      SELECT 
        id,
        action,
        resource_type,
        resource_id,
        description,
        metadata,
        ip_address,
        created_at
      FROM activity_log
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await client.query(logQuery, params);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get activity log error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch activity log",
    });
  } finally {
    client.release();
  }
};

// Get active sessions
const getActiveSessions = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        id,
        device,
        browser,
        os,
        ip_address,
        last_active,
        expires_at,
        created_at,
        CASE WHEN last_active > NOW() - INTERVAL '5 minutes' THEN true ELSE false END as is_current
      FROM user_sessions
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY last_active DESC
    `;

    const result = await client.query(query, [userId]);

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sessions",
    });
  } finally {
    client.release();
  }
};

// Revoke session
const revokeSession = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    await client.query(
      "DELETE FROM user_sessions WHERE id = $1 AND user_id = $2",
      [sessionId, userId]
    );

    // Log activity
    await client.query(
      `SELECT log_activity($1, 'session.revoked', 'session', $2, 'Revoked login session')`,
      [userId, sessionId]
    );

    res.status(200).json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (error) {
    console.error("Revoke session error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to revoke session",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  updatePreferences,
  getLoginHistory,
  getActivityLog,
  getActiveSessions,
  revokeSession,
};
