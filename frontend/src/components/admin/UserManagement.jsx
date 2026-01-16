import { useState, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import api from "../../services/api";
import "./css/UserManagement.css";

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' or 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    role_id: "",
    department: "",
    employee_id: "", // Added employee_id field
    subject: "", // Added subject field for Head Teachers
  });

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/users");
      setUsers(response.data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get("/admin/departments");
      setDepartments(response.data.departments);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get("/admin/roles");
      setRoles(response.data.roles);
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      // Fallback roles if endpoint doesn't exist
      setRoles([
        { role_id: 1, role_name: "Admin" },
        { role_id: 2, role_name: "Principal" },
        { role_id: 3, role_name: "Head Teacher" },
        { role_id: 4, role_name: "Teacher" },
        { role_id: 5, role_name: "Staff" },
      ]);
    }
  };

  const handleOpenModal = (mode, user = null) => {
    setModalMode(mode);
    setSelectedUser(user);
    if (mode === "edit" && user) {
      setFormData({
        username: user.username,
        email: user.email,
        password: "",
        full_name: user.full_name,
        role_id: user.role_id,
        department: user.department || "",
        employee_id: user.employee_id || "", // Include employee_id for edit
        subject: user.subject || "", // Include subject for edit
      });
    } else {
      setFormData({
        username: "",
        email: "",
        password: "",
        full_name: "",
        role_id: "",
        department: "",
        employee_id: "", // Reset employee_id
        subject: "", // Reset subject
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setFormData({
      username: "",
      email: "",
      password: "",
      full_name: "",
      role_id: "",
      department: "",
      employee_id: "",
      subject: "",
    });
    setShowPassword(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === "create") {
        // Prepare data for registration
        const registrationData = {
          ...formData,
          // Only include subject if role is Head Teacher (role_id = 3)
          subject: parseInt(formData.role_id) === 3 ? formData.subject : undefined,
        };
        
        await api.post("/auth/register", registrationData);
        alert("User created successfully!");
      } else {
        // Update user endpoint
        await api.put(`/admin/users/${selectedUser.user_id}`, formData);
        alert("User updated successfully!");
      }
      handleCloseModal();
      fetchUsers();
    } catch (error) {
      console.error("Failed to save user:", error);
      alert(error.response?.data?.message || "Failed to save user");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      alert("User deleted successfully!");
      fetchUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert(error.response?.data?.message || "Failed to delete user");
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      filterRole === "all" || user.role_id === parseInt(filterRole);

    return matchesSearch && matchesRole;
  });

  // Check if selected role is Head Teacher
  const isHeadTeacher = parseInt(formData.role_id) === 3;

  if (loading) {
    return (
      <div className="user-management-loading">
        <div className="loading-spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      {/* Header */}
      <div className="um-header">
        <div className="um-header-left">
          <div className="um-header-icon">
            <Users />
          </div>
          <div>
            <h1>User Management</h1>
            <p>Manage system users, roles, and permissions</p>
          </div>
        </div>
        <button
          className="um-btn-primary"
          onClick={() => handleOpenModal("create")}
        >
          <Plus size={20} />
          Add New User
        </button>
      </div>

      {/* Filters */}
      <div className="um-filters">
        <div className="um-search">
          <Search className="um-search-icon" />
          <input
            type="text"
            placeholder="Search users by name, username, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="um-filter-select"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="all">All Roles</option>
          {roles.map((role) => (
            <option key={role.role_id} value={role.role_id}>
              {role.role_name}
            </option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      <div className="um-table-container">
        <table className="um-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Employee ID</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="um-empty">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.user_id}>
                  <td>
                    <div className="um-user-info">
                      <div className="um-user-avatar">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="um-user-name">{user.full_name}</div>
                        <div className="um-user-username">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`um-role-badge um-role-${user.role_id}`}>
                      {roles.find((r) => r.role_id === user.role_id)?.role_name}
                    </span>
                  </td>
                  <td>{user.department || "—"}</td>
                  <td>{user.employee_id || "—"}</td>
                  <td>
                    {new Date(user.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <div className="um-actions">
                      <button
                        className="um-action-btn"
                        onClick={() => handleOpenModal("edit", user)}
                        title="Edit user"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="um-action-btn um-action-delete"
                        onClick={() => handleDeleteUser(user.user_id)}
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="um-modal-overlay" onClick={handleCloseModal}>
          <div className="um-modal" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal-header">
              <h2>{modalMode === "create" ? "Add New User" : "Edit User"}</h2>
              <button className="um-modal-close" onClick={handleCloseModal}>
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="um-modal-form">
              <div className="um-form-row">
                <div className="um-form-group">
                  <label htmlFor="full_name">
                    Full Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="um-form-group">
                  <label htmlFor="username">
                    Username <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    disabled={modalMode === "edit"}
                  />
                </div>
              </div>

              <div className="um-form-row">
                <div className="um-form-group">
                  <label htmlFor="email">
                    Email <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="um-form-group">
                  <label htmlFor="employee_id">
                    Employee ID <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="employee_id"
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter employee ID"
                  />
                </div>
              </div>

              <div className="um-form-row">
                <div className="um-form-group">
                  <label htmlFor="role_id">
                    Role <span className="required">*</span>
                  </label>
                  <select
                    id="role_id"
                    name="role_id"
                    value={formData.role_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="um-form-group">
                  <label htmlFor="password">
                    Password{" "}
                    {modalMode === "create" && (
                      <span className="required">*</span>
                    )}
                  </label>
                  <div className="um-password-input">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required={modalMode === "create"}
                      placeholder={
                        modalMode === "edit"
                          ? "Leave blank to keep current"
                          : ""
                      }
                    />
                    <button
                      type="button"
                      className="um-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="um-form-row">
                <div className="um-form-group">
                  <label htmlFor="department">
                    Department <span className="required">*</span>
                  </label>
                  <select
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a department</option>
                    {departments.map((dept) => (
                      <option
                        key={dept.department_id}
                        value={dept.department_name}
                      >
                        {dept.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                {isHeadTeacher && (
                  <div className="um-form-group">
                    <label htmlFor="subject">
                      Subject <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required={isHeadTeacher}
                      placeholder="e.g., Mathematics, Science"
                    />
                  </div>
                )}
              </div>

              <div className="um-modal-actions">
                <button
                  type="button"
                  className="um-btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button type="submit" className="um-btn-primary">
                  {modalMode === "create" ? "Create User" : "Update User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
