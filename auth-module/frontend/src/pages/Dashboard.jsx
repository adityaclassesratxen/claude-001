import React from "react";
import styled from "styled-components";
import { Users, Building2, Activity, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const stats = [
    {
      icon: Users,
      label: "Total Users",
      value: "1,234",
      change: "+12%",
      color: "#2563eb",
    },
    {
      icon: Building2,
      label: "Active Tenants",
      value: "45",
      change: "+5%",
      color: "#059669",
    },
    {
      icon: Activity,
      label: "Active Sessions",
      value: "892",
      change: "+18%",
      color: "#7c3aed",
    },
    {
      icon: TrendingUp,
      label: "Growth",
      value: "23%",
      change: "+3%",
      color: "#0d9488",
    },
  ];

  return (
    <DashboardContainer>
      <DashboardHeader>
        <Title>Welcome Back!</Title>
        <Subtitle>Here's what's happening with your system today.</Subtitle>
      </DashboardHeader>

      <StatsGrid>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <StatCard key={index}>
              <StatIcon $color={stat.color}>
                <Icon size={24} />
              </StatIcon>
              <StatContent>
                <StatLabel>{stat.label}</StatLabel>
                <StatValue>{stat.value}</StatValue>
                <StatChange $positive={stat.change.startsWith("+")}>
                  {stat.change} from last month
                </StatChange>
              </StatContent>
            </StatCard>
          );
        })}
      </StatsGrid>

      <ContentGrid>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardBody>
            <ActivityItem>
              <ActivityDot $color="#2563eb" />
              <ActivityContent>
                <ActivityTitle>New user registered</ActivityTitle>
                <ActivityTime>2 minutes ago</ActivityTime>
              </ActivityContent>
            </ActivityItem>
            <ActivityItem>
              <ActivityDot $color="#059669" />
              <ActivityContent>
                <ActivityTitle>Tenant created</ActivityTitle>
                <ActivityTime>15 minutes ago</ActivityTime>
              </ActivityContent>
            </ActivityItem>
            <ActivityItem>
              <ActivityDot $color="#7c3aed" />
              <ActivityContent>
                <ActivityTitle>System update completed</ActivityTitle>
                <ActivityTime>1 hour ago</ActivityTime>
              </ActivityContent>
            </ActivityItem>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardBody>
            <ActionButton>
              <Users size={18} />
              <span>Add New User</span>
            </ActionButton>
            <ActionButton>
              <Building2 size={18} />
              <span>Create Tenant</span>
            </ActionButton>
            <ActionButton>
              <Activity size={18} />
              <span>View Reports</span>
            </ActionButton>
          </CardBody>
        </Card>
      </ContentGrid>
    </DashboardContainer>
  );
};

// Styled Components
const DashboardContainer = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const DashboardHeader = styled.div`
  margin-bottom: 32px;
`;

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

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  gap: 16px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const StatIcon = styled.div`
  width: 56px;
  height: 56px;
  background: ${(props) => props.$color}15;
  color: ${(props) => props.$color};
  border-radius: 12px;
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
  font-size: 14px;
  color: var(--color-textSecondary);
  margin-bottom: 4px;
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 4px;
`;

const StatChange = styled.div`
  font-size: 13px;
  color: ${(props) =>
    props.$positive ? "var(--color-success)" : "var(--color-error)"};
  font-weight: 600;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
`;

const CardHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
`;

const CardTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
`;

const CardBody = styled.div`
  padding: 24px;
`;

const ActivityItem = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ActivityDot = styled.div`
  width: 8px;
  height: 8px;
  background: ${(props) => props.$color};
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
`;

const ActivityContent = styled.div`
  flex: 1;
`;

const ActivityTitle = styled.div`
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
  margin-bottom: 4px;
`;

const ActivityTime = styled.div`
  font-size: 13px;
  color: var(--color-textSecondary);
`;

const ActionButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: white;
  }
`;

export default Dashboard;
