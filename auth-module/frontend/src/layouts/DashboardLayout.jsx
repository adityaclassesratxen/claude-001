import React, { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import styled from "styled-components";
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  User,
} from "lucide-react";
import ThemeSelector from "../components/ThemeSelector";

const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Get user from localStorage (you'll update this with context later)
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const menuItems = [
    {
      path: "/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      roles: ["all"],
    },
    {
      path: "/dashboard/users",
      icon: Users,
      label: "Users",
      roles: ["super_admin", "admin"],
    },
    {
      path: "/dashboard/tenants",
      icon: Building2,
      label: "Tenants",
      roles: ["super_admin"],
    },
    {
      path: "/dashboard/settings",
      icon: Settings,
      label: "Settings",
      roles: ["all"],
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <LayoutContainer>
      {/* Sidebar */}
      <Sidebar $collapsed={sidebarCollapsed} $mobileOpen={mobileSidebarOpen}>
        <SidebarHeader $collapsed={sidebarCollapsed}>
          {!sidebarCollapsed && <Logo>🚀 YourApp</Logo>}
          <CollapseButton
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
          </CollapseButton>
        </SidebarHeader>

        <SidebarMenu>
          {menuItems.map((item) => {
            const Icon = item.icon;
            // Check role access
            if (item.roles.includes("all") || item.roles.includes(user.role)) {
              return (
                <MenuItem
                  key={item.path}
                  to={item.path}
                  $active={isActive(item.path)}
                  $collapsed={sidebarCollapsed}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <Icon size={20} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </MenuItem>
              );
            }
            return null;
          })}
        </SidebarMenu>

        <SidebarFooter $collapsed={sidebarCollapsed}>
          <LogoutButton onClick={handleLogout} $collapsed={sidebarCollapsed}>
            <LogOut size={20} />
            {!sidebarCollapsed && <span>Logout</span>}
          </LogoutButton>
        </SidebarFooter>
      </Sidebar>

      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <MobileOverlay onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <MainContent $sidebarCollapsed={sidebarCollapsed}>
        {/* Top Navbar */}
        <Navbar>
          <NavbarLeft>
            <MobileMenuButton
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              {mobileSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </MobileMenuButton>
            <PageTitle>Dashboard</PageTitle>
          </NavbarLeft>

          <NavbarRight>
            <SearchButton>
              <Search size={20} />
            </SearchButton>

            <NotificationButton>
              <Bell size={20} />
              <NotificationBadge>3</NotificationBadge>
            </NotificationButton>

            <ThemeSelector />

            <UserMenuButton onClick={() => setShowUserMenu(!showUserMenu)}>
              <UserAvatar>
                {user.name?.charAt(0).toUpperCase() || "U"}
              </UserAvatar>
              <UserInfo>
                <UserName>{user.name || "User"}</UserName>
                <UserRole>{user.role || "user"}</UserRole>
              </UserInfo>
            </UserMenuButton>

            {showUserMenu && (
              <UserDropdown>
                <DropdownItem onClick={() => navigate("/dashboard/profile")}>
                  <User size={16} />
                  <span>Profile</span>
                </DropdownItem>
                <DropdownItem onClick={() => navigate("/dashboard/settings")}>
                  <Settings size={16} />
                  <span>Settings</span>
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Logout</span>
                </DropdownItem>
              </UserDropdown>
            )}
          </NavbarRight>
        </Navbar>

        {/* Page Content */}
        <ContentArea>
          <Outlet />
        </ContentArea>
      </MainContent>
    </LayoutContainer>
  );
};

// Styled Components
const LayoutContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background: var(--color-background);
`;

const Sidebar = styled.aside`
  width: ${(props) => (props.$collapsed ? "80px" : "260px")};
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  transition: width 0.3s ease;
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  z-index: 1000;

  @media (max-width: 768px) {
    width: 260px;
    transform: translateX(${(props) => (props.$mobileOpen ? "0" : "-100%")});
    transition: transform 0.3s ease;
  }
`;

const SidebarHeader = styled.div`
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  min-height: 70px;
`;

const Logo = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
  margin: 0;
`;

const CollapseButton = styled.button`
  background: none;
  border: none;
  color: var(--color-textSecondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--color-background);
    color: var(--color-primary);
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const SidebarMenu = styled.nav`
  flex: 1;
  padding: 20px 12px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }
`;

const MenuItem = styled(Link)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  color: ${(props) =>
    props.$active ? "var(--color-primary)" : "var(--color-textSecondary)"};
  background: ${(props) =>
    props.$active ? "var(--color-background)" : "transparent"};
  text-decoration: none;
  font-size: 14px;
  font-weight: ${(props) => (props.$active ? "600" : "400")};
  transition: all 0.3s ease;
  justify-content: ${(props) => (props.$collapsed ? "center" : "flex-start")};

  &:hover {
    background: var(--color-background);
    color: var(--color-primary);
  }

  svg {
    flex-shrink: 0;
  }

  span {
    display: ${(props) => (props.$collapsed ? "none" : "block")};
  }
`;

const SidebarFooter = styled.div`
  padding: 20px 12px;
  border-top: 1px solid var(--color-border);
`;

const LogoutButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-error);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  justify-content: ${(props) => (props.$collapsed ? "center" : "flex-start")};

  &:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  svg {
    flex-shrink: 0;
  }

  span {
    display: ${(props) => (props.$collapsed ? "none" : "block")};
  }
`;

const MobileOverlay = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }
`;

const MainContent = styled.main`
  flex: 1;
  margin-left: ${(props) => (props.$sidebarCollapsed ? "80px" : "260px")};
  transition: margin-left 0.3s ease;
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  @media (max-width: 768px) {
    margin-left: 0;
  }
`;

const Navbar = styled.nav`
  height: 70px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
`;

const NavbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const MobileMenuButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: var(--color-text);
  cursor: pointer;
  padding: 8px;

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const PageTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const NavbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
`;

const SearchButton = styled.button`
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--color-textSecondary);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  @media (max-width: 768px) {
    padding: 8px;
  }
`;

const NotificationButton = styled.button`
  position: relative;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--color-textSecondary);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  @media (max-width: 768px) {
    padding: 8px;
  }
`;

const NotificationBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--color-error);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
`;

const UserMenuButton = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--color-primary);
  }

  @media (max-width: 768px) {
    padding: 8px;
  }
`;

const UserAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  @media (max-width: 768px) {
    display: none;
  }
`;

const UserName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
`;

const UserRole = styled.span`
  font-size: 12px;
  color: var(--color-textSecondary);
  text-transform: capitalize;
`;

const UserDropdown = styled.div`
  position: absolute;
  top: 60px;
  right: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px;
  min-width: 200px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.2s ease;

  @keyframes slideDown {
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

const DropdownItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;

  &:hover {
    background: var(--color-background);
    color: var(--color-primary);
  }

  svg {
    flex-shrink: 0;
  }
`;

const DropdownDivider = styled.div`
  height: 1px;
  background: var(--color-border);
  margin: 8px 0;
`;

const ContentArea = styled.div`
  flex: 1;
  padding: 24px;
  overflow-y: auto;

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

export default DashboardLayout;
