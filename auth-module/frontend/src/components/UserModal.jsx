import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { X, Loader2, Eye, EyeOff } from "lucide-react";

const UserModal = ({ mode, user, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
    status: "active",
    phone: "",
    department: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "edit" && user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        password: "",
        role: user.role || "user",
        status: user.status || "active",
        phone: user.phone || "",
        department: user.department || "",
      });
    }
  }, [mode, user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const url =
        mode === "create"
          ? "http://localhost:5000/api/users"
          : `http://localhost:5000/api/users/${user.id}`;

      const method = mode === "create" ? "POST" : "PUT";

      // Don't send password if editing and password is empty
      const dataToSend = { ...formData };
      if (mode === "edit" && !formData.password) {
        delete dataToSend.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to save user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Overlay onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            {mode === "create" ? "Create New User" : "Edit User"}
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <Form onSubmit={handleSubmit}>
          <FormRow>
            <FormGroup>
              <Label>Name *</Label>
              <Input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </FormGroup>

            <FormGroup>
              <Label>Email *</Label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </FormGroup>
          </FormRow>

          {mode === "create" && (
            <FormGroup>
              <Label>Password *</Label>
              <PasswordWrapper>
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={mode === "create"}
                />
                <EyeButton
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </EyeButton>
              </PasswordWrapper>
              <HelpText>
                Min 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special
                char
              </HelpText>
            </FormGroup>
          )}

          <FormRow>
            <FormGroup>
              <Label>Role *</Label>
              <Select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </Select>
            </FormGroup>

            <FormGroup>
              <Label>Status *</Label>
              <Select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <Label>Phone</Label>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </FormGroup>

            <FormGroup>
              <Label>Department</Label>
              <Input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
              />
            </FormGroup>
          </FormRow>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <ButtonGroup>
            <CancelButton type="button" onClick={onClose}>
              Cancel
            </CancelButton>
            <SubmitButton type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Saving...
                </>
              ) : mode === "create" ? (
                "Create User"
              ) : (
                "Update User"
              )}
            </SubmitButton>
          </ButtonGroup>
        </Form>
      </ModalContainer>
    </Overlay>
  );
};

// Styled Components
const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
`;

const ModalContainer = styled.div`
  background: var(--color-surface);
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid var(--color-border);
`;

const ModalTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: var(--color-textSecondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-background);
    color: var(--color-text);
  }
`;

const Form = styled.form`
  padding: 24px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
`;

const Input = styled.input`
  padding: 12px 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`;

const Select = styled.select`
  padding: 12px 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
  outline: none;
  transition: all 0.3s ease;

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
`;

const PasswordWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const EyeButton = styled.button`
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  color: var(--color-textSecondary);
  cursor: pointer;
  padding: 4px;

  &:hover {
    color: var(--color-primary);
  }
`;

const HelpText = styled.span`
  font-size: 12px;
  color: var(--color-textSecondary);
`;

const ErrorMessage = styled.div`
  background: #fee;
  color: var(--color-error);
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 20px;
  border-left: 4px solid var(--color-error);
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
`;

const CancelButton = styled.button`
  padding: 12px 24px;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: var(--color-background);
  }
`;

const SubmitButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: var(--color-primaryHover);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
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

export default UserModal;
