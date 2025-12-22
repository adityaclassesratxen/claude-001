import React from "react";
import styled from "styled-components";

const Tenants = () => {
  return (
    <Container>
      <Title>Tenants Management</Title>
      <Subtitle>Manage your tenants and organizations</Subtitle>
    </Container>
  );
};

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
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
`;

export default Tenants;
