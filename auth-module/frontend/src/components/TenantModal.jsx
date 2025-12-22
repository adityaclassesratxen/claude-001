import React, { useState, useEffect } from "react";
import styled from "styled-components";
import {
  X,
  Loader2,
  Building2,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Users,
  Calendar,
} from "lucide-react";

const TenantModal = ({ mode, tenant, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logo_url: "",
    domain: "",
    plan: "free",
    subscription_status: "trial",
    max_users: 5,
    max_storage_gb: 1,
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    parent_tenant_id: "",
    status: "active",
  });

  const [parentTenants, setParentTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("basic"); // basic, subscription, contact, address

  useEffect(() => {
    if (mode === "edit" && tenant) {
      setFormData({
        name: tenant.name || "",
        description: tenant.description || "",
        logo_url: tenant.logo_url || "",
        domain: tenant.domain || "",
        plan: tenant.plan || "free",
        subscription_status: tenant.subscription_status || "trial",
        max_users: tenant.max_users || 5,
        max_storage_gb: tenant.max_storage_gb || 1,
        contact_name: tenant.contact_name || "",
        contact_email: tenant.contact_email || "",
        contact_phone: tenant.contact_phone || "",
        address_line1: tenant.address_line1 || "",
        address_line2: tenant.address_line2 || "",
        city: tenant.city || "",
        state: tenant.state || "",
        country: tenant.country || "",
        postal_code: tenant.postal_code || "",
        parent_tenant_id: tenant.parent_tenant_id || "",
        status: tenant.status || "active",
      });
    }

    // Fetch parent tenants
    fetchParentTenants();
  }, [mode, tenant]);

  const fetchParentTenants = async () => {
    try {
      const token = localStorage.getItem("token");
      const excludeId = mode === "edit" ? `?excludeId=${tenant?.id}` : "";
      const response = await fetch(
        `http://localhost:5000/api/tenants/parent-list${excludeId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setParentTenants(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch parent tenants:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === "number" ? parseInt(value) || 0 : value,
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
          ? "http://localhost:5000/api/tenants"
          : `http://localhost:5000/api/tenants/${tenant.id}`;

      const method = mode === "create" ? "POST" : "PUT";

      // Clean up empty strings
      const dataToSend = { ...formData };
      Object.keys(dataToSend).forEach((key) => {
        if (dataToSend[key] === "") {
          dataToSend[key] = null;
        }
      });

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
      setError("Failed to save tenant");
    } finally {
      setLoading(false);
    }
  };

  const planOptions = [
    { value: "free", label: "Free", users: 5, storage: 1 },
    { value: "basic", label: "Basic", users: 10, storage: 5 },
    { value: "pro", label: "Pro", users: 50, storage: 20 },
    { value: "enterprise", label: "Enterprise", users: 999, storage: 100 },
  ];

  const handlePlanChange = (e) => {
    const selectedPlan = planOptions.find((p) => p.value === e.target.value);
    if (selectedPlan) {
      setFormData({
        ...formData,
        plan: selectedPlan.value,
        max_users: selectedPlan.users,
        max_storage_gb: selectedPlan.storage,
      });
    }
  };

  return (
    <Overlay onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <HeaderLeft>
            <IconWrapper>
              <Building2 size={24} />
            </IconWrapper>
            <ModalTitle>
              {mode === "create" ? "Create New Tenant" : "Edit Tenant"}
            </ModalTitle>
          </HeaderLeft>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        {/* Tabs */}
        <TabsContainer>
          <Tab
            $active={activeTab === "basic"}
            onClick={() => setActiveTab("basic")}
          >
            <Building2 size={16} />
            Basic Info
          </Tab>
          <Tab
            $active={activeTab === "subscription"}
            onClick={() => setActiveTab("subscription")}
          >
            <DollarSign size={16} />
            Subscription
          </Tab>
          <Tab
            $active={activeTab === "contact"}
            onClick={() => setActiveTab("contact")}
          >
            <Mail size={16} />
            Contact
          </Tab>
          <Tab
            $active={activeTab === "address"}
            onClick={() => setActiveTab("address")}
          >
            <MapPin size={16} />
            Address
          </Tab>
        </TabsContainer>

        <Form onSubmit={handleSubmit}>
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <TabContent>
              <FormRow>
                <FormGroup>
                  <Label>Tenant Name *</Label>
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Acme Corporation"
                    required
                  />
                  <HelpText>
                    This will be used to generate a unique slug
                  </HelpText>
                </FormGroup>

                <FormGroup>
                  <Label>Domain</Label>
                  <Input
                    type="text"
                    name="domain"
                    value={formData.domain}
                    onChange={handleChange}
                    placeholder="acme.example.com"
                  />
                </FormGroup>
              </FormRow>

              <FormGroup>
                <Label>Description</Label>
                <TextArea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Brief description of the tenant organization..."
                  rows={3}
                />
              </FormGroup>

              <FormRow>
                <FormGroup>
                  <Label>Logo URL</Label>
                  <Input
                    type="url"
                    name="logo_url"
                    value={formData.logo_url}
                    onChange={handleChange}
                    placeholder="https://example.com/logo.png"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Parent Tenant</Label>
                  <Select
                    name="parent_tenant_id"
                    value={formData.parent_tenant_id}
                    onChange={handleChange}
                  >
                    <option value="">None (Top Level)</option>
                    {parentTenants.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    ))}
                  </Select>
                  <HelpText>For hierarchical tenant structure</HelpText>
                </FormGroup>
              </FormRow>

              <FormGroup>
                <Label>Status</Label>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </FormGroup>
            </TabContent>
          )}

          {/* Subscription Tab */}
          {activeTab === "subscription" && (
            <TabContent>
              <PlanCards>
                {planOptions.map((plan) => (
                  <PlanCard
                    key={plan.value}
                    $active={formData.plan === plan.value}
                    onClick={() =>
                      handlePlanChange({ target: { value: plan.value } })
                    }
                  >
                    <PlanName>{plan.label}</PlanName>
                    <PlanDetails>
                      <PlanDetail>
                        <Users size={14} />
                        {plan.users} users
                      </PlanDetail>
                      <PlanDetail>
                        <Calendar size={14} />
                        {plan.storage} GB
                      </PlanDetail>
                    </PlanDetails>
                    {formData.plan === plan.value && <CheckMark>✓</CheckMark>}
                  </PlanCard>
                ))}
              </PlanCards>

              <FormRow>
                <FormGroup>
                  <Label>Subscription Status</Label>
                  <Select
                    name="subscription_status"
                    value={formData.subscription_status}
                    onChange={handleChange}
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </FormGroup>
              </FormRow>

              <FormRow>
                <FormGroup>
                  <Label>Max Users</Label>
                  <Input
                    type="number"
                    name="max_users"
                    value={formData.max_users}
                    onChange={handleChange}
                    min="1"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Max Storage (GB)</Label>
                  <Input
                    type="number"
                    name="max_storage_gb"
                    value={formData.max_storage_gb}
                    onChange={handleChange}
                    min="1"
                  />
                </FormGroup>
              </FormRow>
            </TabContent>
          )}

          {/* Contact Tab */}
          {activeTab === "contact" && (
            <TabContent>
              <FormGroup>
                <Label>Contact Name</Label>
                <InputWithIcon>
                  <Users size={18} />
                  <Input
                    type="text"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleChange}
                    placeholder="John Doe"
                  />
                </InputWithIcon>
              </FormGroup>

              <FormRow>
                <FormGroup>
                  <Label>Contact Email</Label>
                  <InputWithIcon>
                    <Mail size={18} />
                    <Input
                      type="email"
                      name="contact_email"
                      value={formData.contact_email}
                      onChange={handleChange}
                      placeholder="contact@example.com"
                    />
                  </InputWithIcon>
                </FormGroup>

                <FormGroup>
                  <Label>Contact Phone</Label>
                  <InputWithIcon>
                    <Phone size={18} />
                    <Input
                      type="tel"
                      name="contact_phone"
                      value={formData.contact_phone}
                      onChange={handleChange}
                      placeholder="+1 (555) 123-4567"
                    />
                  </InputWithIcon>
                </FormGroup>
              </FormRow>
            </TabContent>
          )}

          {/* Address Tab */}
          {activeTab === "address" && (
            <TabContent>
              <FormGroup>
                <Label>Address Line 1</Label>
                <Input
                  type="text"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  placeholder="123 Main Street"
                />
              </FormGroup>

              <FormGroup>
                <Label>Address Line 2</Label>
                <Input
                  type="text"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  placeholder="Suite 100"
                />
              </FormGroup>

              <FormRow>
                <FormGroup>
                  <Label>City</Label>
                  <Input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="San Francisco"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>State/Province</Label>
                  <Input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="California"
                  />
                </FormGroup>
              </FormRow>

              <FormRow>
                <FormGroup>
                  <Label>Country</Label>
                  <Input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="United States"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Postal Code</Label>
                  <Input
                    type="text"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    placeholder="94102"
                  />
                </FormGroup>
              </FormRow>
            </TabContent>
          )}

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
                "Create Tenant"
              ) : (
                "Update Tenant"
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
  max-width: 800px;
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
  position: sticky;
  top: 0;
  background: var(--color-surface);
  z-index: 10;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const IconWrapper = styled.div`
  width: 40px;
  height: 40px;
  background: var(--color-primary) 15;
  color: var(--color-primary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
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

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid var(--color-border);
  padding: 0 24px;
  background: var(--color-surface);
  position: sticky;
  top: 73px;
  z-index: 9;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 2px;
  }
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid
    ${(props) => (props.$active ? "var(--color-primary)" : "transparent")};
  color: ${(props) =>
    props.$active ? "var(--color-primary)" : "var(--color-textSecondary)"};
  font-size: 14px;
  font-weight: ${(props) => (props.$active ? "600" : "400")};
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;

  &:hover {
    color: var(--color-primary);
  }

  svg {
    flex-shrink: 0;
  }
`;

const Form = styled.form`
  padding: 24px;
`;

const TabContent = styled.div`
  animation: fadeIn 0.3s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
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
  width: 100%;

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  &::placeholder {
    color: var(--color-textSecondary);
  }
`;

const TextArea = styled.textarea`
  padding: 12px 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;
  resize: vertical;
  font-family: inherit;

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  &::placeholder {
    color: var(--color-textSecondary);
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

const InputWithIcon = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  svg {
    position: absolute;
    left: 12px;
    color: var(--color-textSecondary);
    pointer-events: none;
  }

  input {
    padding-left: 44px;
  }
`;

const HelpText = styled.span`
  font-size: 12px;
  color: var(--color-textSecondary);
`;

const PlanCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const PlanCard = styled.div`
  position: relative;
  padding: 20px;
  background: ${(props) =>
    props.$active ? "var(--color-primary)15" : "var(--color-background)"};
  border: 2px solid
    ${(props) =>
      props.$active ? "var(--color-primary)" : "var(--color-border)"};
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const PlanName = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 12px;
  text-transform: capitalize;
`;

const PlanDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PlanDetail = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-textSecondary);

  svg {
    flex-shrink: 0;
  }
`;

const CheckMark = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 24px;
  height: 24px;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
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
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
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

export default TenantModal;
