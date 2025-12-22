import React, { useState, useEffect } from "react";
import styled from "styled-components";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  X,
  Loader2,
  UserPlus,
  Users as UsersIcon,
  UserCheck,
  UserX,
} from "lucide-react";
import UserModal from "../components/UserModal";
import ConfirmDialog from "../components/ConfirmDialog";

const Users = () => {
  // State management
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("DESC");

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' or 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Selection
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        role: roleFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
      });

      const response = await fetch(
        `http://localhost:5000/api/users?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setUsers(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/users/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [
    currentPage,
    pageSize,
    searchTerm,
    roleFilter,
    statusFilter,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchStats();
  }, []);

  // Handlers
  const handleCreateUser = () => {
    setModalMode("create");
    setSelectedUser(null);
    setShowModal(true);
  };

  const handleEditUser = (user) => {
    setModalMode("edit");
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:5000/api/users/${userToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchUsers();
        fetchStats();
        setShowDeleteDialog(false);
        setUserToDelete(null);
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://localhost:5000/api/users/bulk-delete",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: selectedUsers }),
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchUsers();
        fetchStats();
        setSelectedUsers([]);
        setShowBulkActions(false);
      }
    } catch (error) {
      console.error("Failed to bulk delete:", error);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedUsers(users.map((u) => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC");
    } else {
      setSortBy(column);
      setSortOrder("DESC");
    }
  };

  const exportToCSV = () => {
    const headers = [
      "ID",
      "Name",
      "Email",
      "Role",
      "Status",
      "Department",
      "Created At",
    ];
    const csvData = users.map((user) => [
      user.id,
      user.name,
      user.email,
      user.role,
      user.status,
      user.department || "N/A",
      new Date(user.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <Container>
      {/* Header */}
      <Header>
        <HeaderLeft>
          <Title>User Management</Title>
          <Subtitle>Manage your application users</Subtitle>
        </HeaderLeft>
        <HeaderRight>
          <ExportButton onClick={exportToCSV}>
            <Download size={18} />
            <span>Export</span>
          </ExportButton>
          <CreateButton onClick={handleCreateUser}>
            <Plus size={18} />
            <span>Add User</span>
          </CreateButton>
        </HeaderRight>
      </Header>

      {/* Stats Cards */}
      <StatsGrid>
        <StatCard>
          <StatIcon $color="#2563eb">
            <UsersIcon size={24} />
          </StatIcon>
          <StatContent>
            <StatLabel>Total Users</StatLabel>
            <StatValue>{stats.total_users || 0}</StatValue>
          </StatContent>
        </StatCard>

        <StatCard>
          <StatIcon $color="#059669">
            <UserCheck size={24} />
          </StatIcon>
          <StatContent>
            <StatLabel>Active Users</StatLabel>
            <StatValue>{stats.active_users || 0}</StatValue>
          </StatContent>
        </StatCard>

        <StatCard>
          <StatIcon $color="#f59e0b">
            <UserX size={24} />
          </StatIcon>
          <StatContent>
            <StatLabel>Inactive Users</StatLabel>
            <StatValue>{stats.inactive_users || 0}</StatValue>
          </StatContent>
        </StatCard>

        <StatCard>
          <StatIcon $color="#7c3aed">
            <UserPlus size={24} />
          </StatIcon>
          <StatContent>
            <StatLabel>New This Week</StatLabel>
            <StatValue>{stats.new_this_week || 0}</StatValue>
          </StatContent>
        </StatCard>
      </StatsGrid>

      {/* Filters and Search */}
      <FiltersBar>
        <SearchBox>
          <Search size={18} />
          <SearchInput
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <ClearButton onClick={() => setSearchTerm("")}>
              <X size={16} />
            </ClearButton>
          )}
        </SearchBox>

        <FilterGroup>
          <FilterSelect
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </FilterSelect>

          <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FilterSelect>

          <FilterSelect
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </FilterSelect>
        </FilterGroup>
      </FiltersBar>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <BulkActionsBar>
          <BulkInfo>{selectedUsers.length} user(s) selected</BulkInfo>
          <BulkButton $danger onClick={handleBulkDelete}>
            <Trash2 size={16} />
            Delete Selected
          </BulkButton>
          <BulkButton onClick={() => setSelectedUsers([])}>Cancel</BulkButton>
        </BulkActionsBar>
      )}

      {/* Table */}
      <TableCard>
        {loading ? (
          <LoadingState>
            <Loader2 size={40} className="spin" />
            <p>Loading users...</p>
          </LoadingState>
        ) : users.length === 0 ? (
          <EmptyState>
            <UsersIcon size={64} />
            <p>No users found</p>
            <CreateButton onClick={handleCreateUser}>
              <Plus size={18} />
              Add Your First User
            </CreateButton>
          </EmptyState>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: "40px" }}>
                    <Checkbox
                      type="checkbox"
                      checked={selectedUsers.length === users.length}
                      onChange={handleSelectAll}
                    />
                  </Th>
                  <Th onClick={() => handleSort("name")} $sortable>
                    Name{" "}
                    {sortBy === "name" && (sortOrder === "ASC" ? "↑" : "↓")}
                  </Th>
                  <Th onClick={() => handleSort("email")} $sortable>
                    Email{" "}
                    {sortBy === "email" && (sortOrder === "ASC" ? "↑" : "↓")}
                  </Th>
                  <Th onClick={() => handleSort("role")} $sortable>
                    Role{" "}
                    {sortBy === "role" && (sortOrder === "ASC" ? "↑" : "↓")}
                  </Th>
                  <Th>Status</Th>
                  <Th>Department</Th>
                  <Th onClick={() => handleSort("created_at")} $sortable>
                    Created{" "}
                    {sortBy === "created_at" &&
                      (sortOrder === "ASC" ? "↑" : "↓")}
                  </Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <Tr key={user.id}>
                    <Td>
                      <Checkbox
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                      />
                    </Td>
                    <Td>
                      <UserInfo>
                        <UserAvatar>
                          {user.name.charAt(0).toUpperCase()}
                        </UserAvatar>
                        <UserName>{user.name}</UserName>
                      </UserInfo>
                    </Td>
                    <Td>{user.email}</Td>
                    <Td>
                      <RoleBadge $role={user.role}>{user.role}</RoleBadge>
                    </Td>
                    <Td>
                      <StatusBadge $status={user.status}>
                        {user.status}
                      </StatusBadge>
                    </Td>
                    <Td>{user.department || "-"}</Td>
                    <Td>{new Date(user.created_at).toLocaleDateString()}</Td>
                    <Td>
                      <ActionButtons>
                        <ActionButton
                          onClick={() => handleEditUser(user)}
                          title="Edit"
                        >
                          <Edit size={16} />
                        </ActionButton>
                        <ActionButton
                          onClick={() => handleDeleteUser(user)}
                          title="Delete"
                          $danger
                        >
                          <Trash2 size={16} />
                        </ActionButton>
                      </ActionButtons>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            {/* Pagination */}
            <Pagination>
              <PaginationInfo>
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, total)} of {total} users
              </PaginationInfo>
              <PaginationControls>
                <PaginationButton
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={18} />
                </PaginationButton>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) =>
                    (page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)) && (
                      <PageNumber
                        key={page}
                        $active={page === currentPage}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </PageNumber>
                    )
                )}

                <PaginationButton
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={18} />
                </PaginationButton>
              </PaginationControls>
            </Pagination>
          </>
        )}
      </TableCard>

      {/* Modals */}
      {showModal && (
        <UserModal
          mode={modalMode}
          user={selectedUser}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchUsers();
            fetchStats();
            setShowModal(false);
          }}
        />
      )}

      {showDeleteDialog && (
        <ConfirmDialog
          title="Delete User"
          message={`Are you sure you want to delete ${userToDelete?.name}? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteDialog(false);
            setUserToDelete(null);
          }}
        />
      )}
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
  }
`;

const HeaderLeft = styled.div``;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: var(--color-textSecondary);
  margin: 0;
`;

const HeaderRight = styled.div`
  display: flex;
  gap: 12px;
`;

const CreateButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: var(--color-primaryHover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const ExportButton = styled(CreateButton)`
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);

  &:hover {
    background: var(--color-background);
    transform: translateY(-2px);
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 16px;
`;

const StatIcon = styled.div`
  width: 48px;
  height: 48px;
  background: ${(props) => props.$color}15;
  color: ${(props) => props.$color};
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const StatContent = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const StatLabel = styled.div`
  font-size: 13px;
  color: var(--color-textSecondary);
  margin-bottom: 4px;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
`;

const FiltersBar = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const SearchBox = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 16px;

  svg {
    color: var(--color-textSecondary);
    flex-shrink: 0;
  }
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  outline: none;

  &::placeholder {
    color: var(--color-textSecondary);
  }
`;

const ClearButton = styled.button`
  background: none;
  border: none;
  color: var(--color-textSecondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;

  &:hover {
    color: var(--color-text);
  }
`;

const FilterGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const FilterSelect = styled.select`
  padding: 10px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
  outline: none;

  &:hover {
    border-color: var(--color-primary);
  }
`;

const BulkActionsBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--color-primary) 15;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  margin-bottom: 20px;
`;

const BulkInfo = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
`;

const BulkButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: ${(props) =>
    props.$danger ? "var(--color-error)" : "var(--color-surface)"};
  color: ${(props) => (props.$danger ? "white" : "var(--color-text)")};
  border: 1px solid
    ${(props) => (props.$danger ? "var(--color-error)" : "var(--color-border)")};
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const TableCard = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  padding: 16px;
  background: var(--color-background);
  color: var(--color-textSecondary);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--color-border);
  cursor: ${(props) => (props.$sortable ? "pointer" : "default")};
  user-select: none;

  &:hover {
    color: ${(props) =>
      props.$sortable ? "var(--color-primary)" : "var(--color-textSecondary)"};
  }
`;

const Tr = styled.tr`
  border-bottom: 1px solid var(--color-border);
  transition: background 0.2s ease;

  &:hover {
    background: var(--color-background);
  }
`;

const Td = styled.td`
  padding: 16px;
  color: var(--color-text);
  font-size: 14px;
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const UserAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
`;

const UserName = styled.span`
  font-weight: 500;
`;

const RoleBadge = styled.span`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${(props) => {
    switch (props.$role) {
      case "super_admin":
        return "#7c3aed15";
      case "admin":
        return "#2563eb15";
      default:
        return "#05966915";
    }
  }};
  color: ${(props) => {
    switch (props.$role) {
      case "super_admin":
        return "#7c3aed";
      case "admin":
        return "#2563eb";
      default:
        return "#059669";
    }
  }};
  text-transform: capitalize;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${(props) =>
    props.$status === "active" ? "#05966915" : "#f59e0b15"};
  color: ${(props) => (props.$status === "active" ? "#059669" : "#f59e0b")};
  text-transform: capitalize;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button`
  padding: 6px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: ${(props) =>
    props.$danger ? "var(--color-error)" : "var(--color-textSecondary)"};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) =>
      props.$danger ? "var(--color-error)15" : "var(--color-background)"};
    border-color: ${(props) =>
      props.$danger ? "var(--color-error)" : "var(--color-primary)"};
    color: ${(props) =>
      props.$danger ? "var(--color-error)" : "var(--color-primary)"};
  }
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--color-textSecondary);

  .spin {
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
    color: var(--color-primary);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;

  svg {
    color: var(--color-textSecondary);
    margin-bottom: 16px;
  }

  p {
    color: var(--color-textSecondary);
    font-size: 16px;
    margin-bottom: 24px;
  }
`;

const Pagination = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-top: 1px solid var(--color-border);

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
  }
`;

const PaginationInfo = styled.div`
  color: var(--color-textSecondary);
  font-size: 14px;
`;

const PaginationControls = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const PaginationButton = styled.button`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const PageNumber = styled.button`
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) =>
    props.$active ? "var(--color-primary)" : "var(--color-surface)"};
  color: ${(props) => (props.$active ? "white" : "var(--color-text)")};
  border: 1px solid
    ${(props) =>
      props.$active ? "var(--color-primary)" : "var(--color-border)"};
  border-radius: 6px;
  font-size: 14px;
  font-weight: ${(props) => (props.$active ? "600" : "400")};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
`;

export default Users;
