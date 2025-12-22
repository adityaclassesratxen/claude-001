import React from "react";
import styled from "styled-components";
import { AlertTriangle } from "lucide-react";

const ConfirmDialog = ({ title, message, onConfirm, onCancel }) => {
  return (
    <Overlay onClick={onCancel}>
      <DialogContainer onClick={(e) => e.stopPropagation()}>
        <IconWrapper>
          <AlertTriangle size={48} color="#f59e0b" />
        </IconWrapper>
        <Title>{title}</Title>
        <Message>{message}</Message>
        <ButtonGroup>
          <CancelButton onClick={onCancel}>Cancel</CancelButton>
          <ConfirmButton onClick={onConfirm}>Delete</ConfirmButton>
        </ButtonGroup>
      </DialogContainer>
    </Overlay>
  );
};

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

const DialogContainer = styled.div`
  background: var(--color-surface);
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const IconWrapper = styled.div`
  margin-bottom: 20px;
`;

const Title = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 12px 0;
`;

const Message = styled.p`
  font-size: 14px;
  color: var(--color-textSecondary);
  margin: 0 0 24px 0;
  line-height: 1.5;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
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

const ConfirmButton = styled.button`
  padding: 12px 24px;
  background: var(--color-error);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #dc2626;
    transform: translateY(-2px);
  }
`;

export default ConfirmDialog;
