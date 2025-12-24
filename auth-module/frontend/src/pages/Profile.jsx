import React, { useState, useEffect } from "react";
import styled from "styled-components";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Globe,
  Shield,
  Bell,
  Clock,
  Activity as ActivityIcon,
  Camera,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
} from "lucide-react";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    bio: "",
    job_title: "",
    location: "",
    timezone: "UTC",
    language: "en",
    avatar_url: "",
  });

  const [preferences, setPreferences] = useState({
    email_notifications: true,
    push_notifications: true,
    sms_notifications: false,
    marketing_emails: false,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loginHistory, setLoginHistory] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);

  const withAuth = (options = {}) => {
    const token = localStorage.getItem("token");
    return {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    };
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/profile",
        withAuth()
      );
      const data = await response.json();
      if (data.success) {
        setProfileData({
          name: data.data.name || "",
          email: data.data.email || "",
          phone: data.data.phone || "",
          bio: data.data.bio || "",
          job_title: data.data.job_title || "",
          location: data.data.location || "",
          timezone: data.data.timezone || "UTC",
          language: data.data.language || "en",
          avatar_url: data.data.avatar_url || "",
        });

        setPreferences({
          email_notifications: data.data.email_notifications,
          push_notifications: data.data.push_notifications,
          sms_notifications: data.data.sms_notifications,
          marketing_emails: data.data.marketing_emails,
        });
      } else {
        setMessage({ type: "error", text: data.message || "Profile not found" });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      setMessage({ type: "error", text: "Failed to fetch profile" });
    } finally {
      setLoading(false);
    }
  };

  const fetchLoginHistory = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/profile/login-history?limit=10",
        withAuth()
      );
      const data = await response.json();
      if (data.success) {
        setLoginHistory(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch login history:", error);
    }
  };

  const fetchActivityLog = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/profile/activity?limit=10",
        withAuth()
      );
      const data = await response.json();
      if (data.success) {
        setActivityLog(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch activity log:", error);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/profile/sessions",
        withAuth()
      );
      const data = await response.json();
      if (data.success) {
        setActiveSessions(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (activeTab === "security") {
      fetchLoginHistory();
      fetchActiveSessions();
    }
    if (activeTab === "activity") {
      fetchActivityLog();
    }
  }, [activeTab]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(
        "http://localhost:5000/api/profile",
        withAuth({
          method: "PUT",
          body: JSON.stringify(profileData),
        })
      );
      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem(
          "user",
          JSON.stringify({ ...user, name: profileData.name })
        );
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const avatarUrl = reader.result;
      try {
        const response = await fetch(
          "http://localhost:5000/api/profile/avatar",
          withAuth({
            method: "PUT",
            body: JSON.stringify({ avatar_url: avatarUrl }),
          })
        );
        const data = await response.json();
        if (data.success) {
          setProfileData({ ...profileData, avatar_url: avatarUrl });
          setMessage({ type: "success", text: "Avatar updated successfully!" });
        } else {
          setMessage({ type: "error", text: data.message });
        }
      } catch (error) {
        setMessage({ type: "error", text: "Failed to update avatar" });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(
        "http://localhost:5000/api/profile/password",
        withAuth({
          method: "PUT",
          body: JSON.stringify({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword,
          }),
        })
      );
      const data = await response.json();
      if (data.success) {
        setMessage({ type: "success", text: "Password changed successfully!" });
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to change password" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePreferences = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(
        "http://localhost:5000/api/profile/preferences",
        withAuth({
          method: "PUT",
          body: JSON.stringify(preferences),
        })
      );
      const data = await response.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: "Preferences updated successfully!",
        });
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update preferences" });
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/profile/sessions/${sessionId}`,
        withAuth({ method: "DELETE" })
      );
      const data = await response.json();
      if (data.success) {
        setMessage({
          type: "success",
          text: "Session revoked successfully!",
        });
        fetchActiveSessions();
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to revoke session" });
    }
  };

  const getDeviceIcon = (device) => {
    switch (device?.toLowerCase()) {
      case "mobile":
        return <Smartphone size={16} />;
      case "tablet":
        return <Tablet size={16} />;
      default:
        return <Monitor size={16} />;
    }
  };

  if (loading) {
    return (
      <LoadingContainer>
        <Loader2 size={40} className="spin" />
        <p>Loading profile...</p>
      </LoadingContainer>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderContent>
          <AvatarSection>
            <AvatarWrapper>
              {profileData.avatar_url ? (
                <Avatar src={profileData.avatar_url} alt={profileData.name} />
              ) : (
                <AvatarPlaceholder>
                  {profileData.name.charAt(0).toUpperCase()}
                </AvatarPlaceholder>
              )}
              <AvatarUpload>
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: "none" }}
                />
                <label htmlFor="avatar-upload">
                  <Camera size={16} />
                </label>
              </AvatarUpload>
            </AvatarWrapper>
            <UserInfo>
              <UserName>{profileData.name}</UserName>
              <UserEmail>{profileData.email}</UserEmail>
              {profileData.job_title && (
                <UserTitle>{profileData.job_title}</UserTitle>
              )}
            </UserInfo>
          </AvatarSection>
        </HeaderContent>
      </Header>

      {message.text && (
        <Message $type={message.type}>
          {message.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {message.text}
        </Message>
      )}

      <TabsContainer>
        <Tab
          $active={activeTab === "general"}
          onClick={() => setActiveTab("general")}
        >
          <User size={16} />
          General
        </Tab>
        <Tab
          $active={activeTab === "security"}
          onClick={() => setActiveTab("security")}
        >
          <Shield size={16} />
          Security
        </Tab>
        <Tab
          $active={activeTab === "preferences"}
          onClick={() => setActiveTab("preferences")}
        >
          <Bell size={16} />
          Preferences
        </Tab>
        <Tab
          $active={activeTab === "activity"}
          onClick={() => setActiveTab("activity")}
        >
          <ActivityIcon size={16} />
          Activity
        </Tab>
      </TabsContainer>

      <TabContent>
        {activeTab === "general" && (
          <Form onSubmit={handleUpdateProfile}>
            <Section>
              <SectionTitle>Personal Information</SectionTitle>

              <FormRow>
                <FormGroup>
                  <Label>Full Name</Label>
                  <InputWithIcon>
                    <User size={18} />
                    <Input
                      type="text"
                      value={profileData.name}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                  </InputWithIcon>
                </FormGroup>

                <FormGroup>
                  <Label>Email</Label>
                  <InputWithIcon>
                    <Mail size={18} />
                    <Input
                      type="email"
                      value={profileData.email}
                      disabled
                      style={{ opacity: 0.6, cursor: "not-allowed" }}
                    />
                  </InputWithIcon>
                  <HelpText>Email cannot be changed</HelpText>
                </FormGroup>
              </FormRow>

              <FormRow>
                <FormGroup>
                  <Label>Phone</Label>
                  <InputWithIcon>
                    <Phone size={18} />
                    <Input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          phone: e.target.value,
                        })
                      }
                      placeholder="+1 (555) 123-4567"
                    />
                  </InputWithIcon>
                </FormGroup>

                <FormGroup>
                  <Label>Job Title</Label>
                  <InputWithIcon>
                    <Briefcase size={18} />
                    <Input
                      type="text"
                      value={profileData.job_title}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          job_title: e.target.value,
                        })
                      }
                      placeholder="Software Engineer"
                    />
                  </InputWithIcon>
                </FormGroup>
              </FormRow>

              <FormGroup>
                <Label>Bio</Label>
                <TextArea
                  value={profileData.bio}
                  onChange={(e) =>
                    setProfileData({ ...profileData, bio: e.target.value })
                  }
                  placeholder="Tell us about yourself..."
                  rows={4}
                />
              </FormGroup>

              <FormRow>
                <FormGroup>
                  <Label>Location</Label>
                  <InputWithIcon>
                    <MapPin size={18} />
                    <Input
                      type="text"
                      value={profileData.location}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          location: e.target.value,
                        })
                      }
                      placeholder="San Francisco, CA"
                    />
                  </InputWithIcon>
                </FormGroup>

                <FormGroup>
                  <Label>Timezone</Label>
                  <InputWithIcon>
                    <Globe size={18} />
                    <Select
                      value={profileData.timezone}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          timezone: e.target.value,
                        })
                      }
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                      <option value="Asia/Shanghai">Shanghai</option>
                    </Select>
                  </InputWithIcon>
                </FormGroup>
              </FormRow>
            </Section>

            <ButtonGroup>
              <SaveButton type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </SaveButton>
            </ButtonGroup>
          </Form>
        )}

        {activeTab === "security" && (
          <>
            <Section>
              <SectionTitle>Change Password</SectionTitle>
              <Form onSubmit={handleChangePassword}>
                <FormGroup>
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    required
                  />
                </FormGroup>

                <FormRow>
                  <FormGroup>
                    <Label>New Password</Label>
                    <Input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        })
                      }
                      required
                    />
                    <HelpText>
                      Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special
                      char
                    </HelpText>
                  </FormGroup>

                  <FormGroup>
                    <Label>Confirm New Password</Label>
                    <Input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value,
                        })
                      }
                      required
                    />
                  </FormGroup>
                </FormRow>

                <ButtonGroup>
                  <SaveButton type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 size={18} className="spin" />
                        Changing...
                      </>
                    ) : (
                      "Change Password"
                    )}
                  </SaveButton>
                </ButtonGroup>
              </Form>
            </Section>

            <Section>
              <SectionTitle>Active Sessions</SectionTitle>
              {activeSessions.length === 0 ? (
                <EmptyState>No active sessions</EmptyState>
              ) : (
                <SessionsList>
                  {activeSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      $isCurrent={session.is_current}
                    >
                      <SessionIcon>
                        {getDeviceIcon(session.device)}
                      </SessionIcon>
                      <SessionInfo>
                        <SessionDevice>
                          {session.device} • {session.browser} on {session.os}
                          {session.is_current && (
                            <CurrentBadge>Current</CurrentBadge>
                          )}
                        </SessionDevice>
                        <SessionDetails>
                          {session.ip_address} • Last active:{" "}
                          {new Date(session.last_active).toLocaleString()}
                        </SessionDetails>
                      </SessionInfo>
                      {!session.is_current && (
                        <RevokeButton
                          type="button"
                          onClick={() => handleRevokeSession(session.id)}
                        >
                          <LogOut size={16} />
                        </RevokeButton>
                      )}
                    </SessionItem>
                  ))}
                </SessionsList>
              )}
            </Section>

            <Section>
              <SectionTitle>Login History</SectionTitle>
              {loginHistory.length === 0 ? (
                <EmptyState>No login history</EmptyState>
              ) : (
                <HistoryTable>
                  <thead>
                    <tr>
                      <Th>Date &amp; Time</Th>
                      <Th>Device</Th>
                      <Th>Location</Th>
                      <Th>IP Address</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.map((login) => (
                      <Tr key={login.id}>
                        <Td>{new Date(login.login_at).toLocaleString()}</Td>
                        <Td>
                          <DeviceInfo>
                            {getDeviceIcon(login.device)}
                            {login.browser} on {login.os}
                          </DeviceInfo>
                        </Td>
                        <Td>{login.location || "Unknown"}</Td>
                        <Td>{login.ip_address}</Td>
                        <Td>
                          <StatusBadge $success={login.success}>
                            {login.success ? "Success" : "Failed"}
                          </StatusBadge>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </HistoryTable>
              )}
            </Section>
          </>
        )}

        {activeTab === "preferences" && (
          <Section>
            <SectionTitle>Notification Preferences</SectionTitle>

            <PreferenceItem>
              <PreferenceInfo>
                <PreferenceLabel>
                  <Mail size={20} />
                  Email Notifications
                </PreferenceLabel>
                <PreferenceDescription>
                  Receive email notifications about your account activity
                </PreferenceDescription>
              </PreferenceInfo>
              <Toggle
                type="checkbox"
                checked={preferences.email_notifications}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    email_notifications: e.target.checked,
                  })
                }
              />
            </PreferenceItem>

            <PreferenceItem>
              <PreferenceInfo>
                <PreferenceLabel>
                  <Bell size={20} />
                  Push Notifications
                </PreferenceLabel>
                <PreferenceDescription>
                  Receive push notifications in your browser
                </PreferenceDescription>
              </PreferenceInfo>
              <Toggle
                type="checkbox"
                checked={preferences.push_notifications}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    push_notifications: e.target.checked,
                  })
                }
              />
            </PreferenceItem>

            <PreferenceItem>
              <PreferenceInfo>
                <PreferenceLabel>
                  <Phone size={20} />
                  SMS Notifications
                </PreferenceLabel>
                <PreferenceDescription>
                  Receive SMS notifications for important updates
                </PreferenceDescription>
              </PreferenceInfo>
              <Toggle
                type="checkbox"
                checked={preferences.sms_notifications}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    sms_notifications: e.target.checked,
                  })
                }
              />
            </PreferenceItem>

            <PreferenceItem>
              <PreferenceInfo>
                <PreferenceLabel>
                  <Mail size={20} />
                  Marketing Emails
                </PreferenceLabel>
                <PreferenceDescription>
                  Receive emails about new features and updates
                </PreferenceDescription>
              </PreferenceInfo>
              <Toggle
                type="checkbox"
                checked={preferences.marketing_emails}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    marketing_emails: e.target.checked,
                  })
                }
              />
            </PreferenceItem>

            <ButtonGroup>
              <SaveButton
                type="button"
                onClick={handleUpdatePreferences}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Preferences
                  </>
                )}
              </SaveButton>
            </ButtonGroup>
          </Section>
        )}

        {activeTab === "activity" && (
          <Section>
            <SectionTitle>Recent Activity</SectionTitle>
            {activityLog.length === 0 ? (
              <EmptyState>No activity yet</EmptyState>
            ) : (
              <ActivityTimeline>
                {activityLog.map((activity) => (
                  <ActivityItem key={activity.id}>
                    <ActivityDot />
                    <ActivityContent>
                      <ActivityAction>
                        {activity.description || activity.action}
                      </ActivityAction>
                      <ActivityTime>
                        <Clock size={14} />
                        {new Date(activity.created_at).toLocaleString()}
                      </ActivityTime>
                      {activity.metadata &&
                        Object.keys(activity.metadata).length > 0 && (
                          <ActivityMeta>
                            {JSON.stringify(activity.metadata)}
                          </ActivityMeta>
                        )}
                    </ActivityContent>
                  </ActivityItem>
                ))}
              </ActivityTimeline>
            )}
          </Section>
        )}
      </TabContent>
    </Container>
  );
};

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
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

const Header = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 24px;
`;

const HeaderContent = styled.div``;

const AvatarSection = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;

  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
  }
`;

const AvatarWrapper = styled.div`
  position: relative;
`;

const Avatar = styled.img`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--color-border);
`;

const AvatarPlaceholder = styled.div`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 700;
  border: 4px solid var(--color-border);
`;

const AvatarUpload = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 3px solid var(--color-surface);
  transition: all 0.3s ease;

  label {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    width: 100%;
    height: 100%;
  }

  &:hover {
    background: var(--color-primaryHover);
    transform: scale(1.1);
  }
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const UserName = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
`;

const UserEmail = styled.div`
  font-size: 16px;
  color: var(--color-textSecondary);
`;

const UserTitle = styled.div`
  font-size: 14px;
  color: var(--color-textSecondary);
  margin-top: 4px;
`;

const Message = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 24px;
  background: ${(props) =>
    props.$type === "success" ? "#d1fae5" : "#fee2e2"};
  color: ${(props) => (props.$type === "success" ? "#065f46" : "#991b1b")};
  border-left: 4px solid
    ${(props) => (props.$type === "success" ? "#059669" : "#dc2626")};
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 8px;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: 32px;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 4px;
  }
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  background: none;
  border: none;
  border-bottom: 3px solid
    ${(props) => (props.$active ? "var(--color-primary)" : "transparent")};
  color: ${(props) =>
    props.$active ? "var(--color-primary)" : "var(--color-textSecondary)"};
  font-size: 15px;
  font-weight: ${(props) => (props.$active ? "600" : "400")};
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  margin-bottom: -2px;

  &:hover {
    color: var(--color-primary);
  }

  svg {
    flex-shrink: 0;
  }
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

const Form = styled.form``;

const Section = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 24px;
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 24px 0;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
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
  width: 100%;

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

  input,
  select {
    padding-left: 44px;
  }
`;

const HelpText = styled.span`
  font-size: 12px;
  color: var(--color-textSecondary);
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
`;

const SaveButton = styled.button`
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
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

const SessionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SessionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: ${(props) =>
    props.$isCurrent ? "rgba(37, 99, 235, 0.08)" : "var(--color-background)"};
  border: 1px solid
    ${(props) =>
      props.$isCurrent ? "var(--color-primary)" : "var(--color-border)"};
  border-radius: 8px;
`;

const SessionIcon = styled.div`
  width: 40px;
  height: 40px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-textSecondary);
  flex-shrink: 0;
`;

const SessionInfo = styled.div`
  flex: 1;
`;

const SessionDevice = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CurrentBadge = styled.span`
  padding: 2px 8px;
  background: var(--color-success);
  color: white;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
`;

const SessionDetails = styled.div`
  font-size: 13px;
  color: var(--color-textSecondary);
`;

const RevokeButton = styled.button`
  padding: 8px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-error);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: var(--color-error);
  }
`;

const HistoryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  padding: 12px;
  background: var(--color-background);
  color: var(--color-textSecondary);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border);
`;

const Tr = styled.tr`
  border-bottom: 1px solid var(--color-border);

  &:hover {
    background: var(--color-background);
  }
`;

const Td = styled.td`
  padding: 12px;
  font-size: 14px;
  color: var(--color-text);
`;

const DeviceInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${(props) => (props.$success ? "#d1fae5" : "#fee2e2")};
  color: ${(props) => (props.$success ? "#065f46" : "#991b1b")};
`;

const PreferenceItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
`;

const PreferenceInfo = styled.div`
  flex: 1;
`;

const PreferenceLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;

  svg {
    color: var(--color-primary);
  }
`;

const PreferenceDescription = styled.div`
  font-size: 14px;
  color: var(--color-textSecondary);
  margin-left: 32px;
`;

const Toggle = styled.input`
  appearance: none;
  width: 48px;
  height: 24px;
  background: var(--color-border);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;

  &:checked {
    background: var(--color-primary);
  }

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: all 0.3s ease;
  }

  &:checked::after {
    left: 26px;
  }
`;

const ActivityTimeline = styled.div`
  display: flex;
  flex-direction: column;
`;

const ActivityItem = styled.div`
  display: flex;
  gap: 16px;
  padding: 16px 0;
  border-left: 2px solid var(--color-border);
  margin-left: 8px;
  padding-left: 24px;
  position: relative;

  &:last-child {
    border-left-color: transparent;
  }
`;

const ActivityDot = styled.div`
  position: absolute;
  left: -9px;
  top: 20px;
  width: 16px;
  height: 16px;
  background: var(--color-primary);
  border: 3px solid var(--color-surface);
  border-radius: 50%;
`;

const ActivityContent = styled.div`
  flex: 1;
`;

const ActivityAction = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
`;

const ActivityTime = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-textSecondary);
`;

const ActivityMeta = styled.div`
  font-size: 12px;
  color: var(--color-textSecondary);
  margin-top: 8px;
  padding: 8px;
  background: var(--color-background);
  border-radius: 4px;
  font-family: monospace;
  word-break: break-word;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: var(--color-textSecondary);
  font-size: 14px;
`;

export default Profile;
