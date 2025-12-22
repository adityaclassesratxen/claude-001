const pool = require("../config/database");

// Get all users with pagination, search, filters, sort
const getUsers = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      role = "",
      status = "",
      sortBy = "created_at",
      sortOrder = "DESC",
    } = req.query;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereConditions = ["u.is_deleted = FALSE"];
    let queryParams = [];
    let paramIndex = 1;

    // Search filter
    if (search) {
      whereConditions.push(
        `(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`
      );
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Role filter
    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      queryParams.push(role);
      paramIndex++;
    }

    // Status filter
    if (status) {
      whereConditions.push(`u.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Tenant filter (if not super_admin)
    if (req.user && req.user.role !== "super_admin" && req.user.tenant_id) {
      whereConditions.push(`u.tenant_id = $${paramIndex}`);
      queryParams.push(req.user.tenant_id);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Validate sort column
    const allowedSortColumns = [
      "name",
      "email",
      "role",
      "status",
      "created_at",
      "last_login",
    ];
    const sortColumn = allowedSortColumns.includes(sortBy)
      ? sortBy
      : "created_at";
    const sortDirection = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      ${whereClause}
    `;
    const countResult = await client.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated users
    const usersQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.phone,
        u.department,
        u.tenant_id,
        t.name as tenant_name,
        u.last_login,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      ${whereClause}
      ORDER BY u.${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const usersResult = await client.query(usersQuery, queryParams);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: usersResult.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  } finally {
    client.release();
  }
};

// Get single user by ID
const getUserById = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.phone,
        u.department,
        u.tenant_id,
        t.name as tenant_name,
        u.last_login,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = $1 AND u.is_deleted = FALSE
    `;

    const result = await client.query(query, [id]);

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
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  } finally {
    client.release();
  }
};

// Create new user
const createUser = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      name,
      email,
      password,
      role,
      status,
      phone,
      department,
      tenant_id,
    } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and role are required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Password validation
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      });
    }

    // Check if email already exists
    const emailCheck = await client.query(
      "SELECT id FROM users WHERE email = $1 AND is_deleted = FALSE",
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const insertQuery = `
      INSERT INTO users (name, email, password, role, status, phone, department, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, email, role, status, phone, department, tenant_id, created_at
    `;

    const values = [
      name,
      email,
      hashedPassword,
      role,
      status || "active",
      phone || null,
      department || null,
      tenant_id || null,
    ];

    const result = await client.query(insertQuery, values);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  } finally {
    client.release();
  }
};

// Update user
const updateUser = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { name, email, role, status, phone, department, tenant_id } =
      req.body;

    // Check if user exists
    const userCheck = await client.query(
      "SELECT id FROM users WHERE id = $1 AND is_deleted = FALSE",
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if email is taken by another user
    if (email) {
      const emailCheck = await client.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2 AND is_deleted = FALSE",
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
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
    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(phone);
      paramIndex++;
    }
    if (department !== undefined) {
      updates.push(`department = $${paramIndex}`);
      values.push(department);
      paramIndex++;
    }
    if (tenant_id !== undefined) {
      updates.push(`tenant_id = $${paramIndex}`);
      values.push(tenant_id);
      paramIndex++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, role, status, phone, department, tenant_id, updated_at
    `;

    const result = await client.query(updateQuery, values);

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  } finally {
    client.release();
  }
};

// Delete user (soft delete)
const deleteUser = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    // Check if user exists
    const userCheck = await client.query(
      "SELECT id FROM users WHERE id = $1 AND is_deleted = FALSE",
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent self-deletion
    if (req.user && req.user.id === parseInt(id)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // Soft delete
    const deleteQuery = `
      UPDATE users
      SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
      WHERE id = $2
    `;

    await client.query(deleteQuery, [req.user?.id || null, id]);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  } finally {
    client.release();
  }
};

// Bulk delete users
const bulkDeleteUsers = async (req, res) => {
  const client = await pool.connect();

  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs array is required",
      });
    }

    // Prevent self-deletion
    if (req.user && ids.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    const deleteQuery = `
      UPDATE users
      SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
      WHERE id = ANY($2) AND is_deleted = FALSE
    `;

    const result = await client.query(deleteQuery, [req.user?.id || null, ids]);

    res.status(200).json({
      success: true,
      message: `${result.rowCount} user(s) deleted successfully`,
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete users",
    });
  } finally {
    client.release();
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  const client = await pool.connect();

  try {
    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE is_deleted = FALSE) as total_users,
        COUNT(*) FILTER (WHERE status = 'active' AND is_deleted = FALSE) as active_users,
        COUNT(*) FILTER (WHERE status = 'inactive' AND is_deleted = FALSE) as inactive_users,
        COUNT(*) FILTER (WHERE role = 'super_admin' AND is_deleted = FALSE) as super_admins,
        COUNT(*) FILTER (WHERE role = 'admin' AND is_deleted = FALSE) as admins,
        COUNT(*) FILTER (WHERE role = 'user' AND is_deleted = FALSE) as regular_users,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND is_deleted = FALSE) as new_this_week,
        COUNT(*) FILTER (WHERE last_login >= CURRENT_DATE - INTERVAL '7 days' AND is_deleted = FALSE) as active_this_week
      FROM users
    `;

    const result = await client.query(statsQuery);

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  getUserStats,
};
